from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment first
load_dotenv()

# Import security
from app.core.security import verify_internal_api_key

# Global variables for services
context_manager = None
deal_hunter_agent = None

# Lifespan event handler (modern approach)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global context_manager, deal_hunter_agent
    
    print("🚀 AI Service Starting...")
    
    from app.core.context import ContextManager
    from app.agents.deal_hunter import DealHunterAgent
    
    context_manager = ContextManager()
    deal_hunter_agent = DealHunterAgent()
    
    print(f"✅ Ready on http://localhost:8000")
    print(f"🔑 Auth: {'Configured' if os.getenv('INTERNAL_API_SECRET') else 'Missing'}")
    print(f"🤖 LLM: OpenAI GPT-4\n")
    
    yield
    
    # Shutdown (if needed)
    print("👋 AI Service Shutting Down...")

# Create FastAPI app with lifespan
app = FastAPI(
    title="AI Real Estate Investment Assistant",
    version="1.0.0",
    description="Microservice for AI-powered real estate analysis",
    lifespan=lifespan
)

# CORS
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your backend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class UserProfile(BaseModel):
    propertyType: str
    strategy: str
    rentalType: Optional[str] = None
    startingCapital: float
    targetGeography: str
    investmentTimeline: str
    profitGoal: float

class ChatMessage(BaseModel):
    userId: str
    sessionId: str
    message: str
    agentType: str = "deal-hunter"

    # =====================================================
    # ADDITION: ACCEPT USER PROFILE FROM BACKEND
    # =====================================================
    userProfile: Optional[dict] = None

class OnboardingRequest(BaseModel):
    userId: str
    profile: UserProfile

# Routes
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI Real Estate Investment Assistant",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "HEALTHY",
        "service": "AI-Service",
        "llm_provider": "OpenAI"
    }

@app.post("/api/onboarding")
async def onboarding(
    request: OnboardingRequest,
    authorized: bool = Depends(verify_internal_api_key)
):
    """Store user onboarding profile"""
    try:
        context_manager.set_user_context(
            user_id=request.userId,
            profile=request.profile.dict()
        )
        
        return {
            "success": True,
            "message": "User profile saved successfully",
            "userId": request.userId
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(
    request: ChatMessage,
    authorized: bool = Depends(verify_internal_api_key)
):
    """Handle chat messages"""
    try:
        # =====================================================
        # ADDITION: ACCEPT & STORE PROFILE IF PROVIDED
        # =====================================================
        if request.userProfile:
            context_manager.set_user_context(
                user_id=request.userId,
                profile=request.userProfile
            )

        # Check if user profile exists
        if not context_manager.get_user_context(request.userId):
            raise HTTPException(
                status_code=404, 
                detail="User profile not found. Please complete onboarding first."
            )
        
        # Create session if needed
        user_context = context_manager.get_user_context(request.userId)
        if request.sessionId not in user_context.get("sessions", {}):
            context_manager.create_session(
                request.userId,
                request.sessionId,
                request.agentType
            )
        
        # Process message with agent
        if request.agentType == "deal-hunter":
            response = await deal_hunter_agent.process_message(
                request.userId,
                request.sessionId,
                request.message
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid agent type")
        
        return {
            "success": True,
            "response": response,
            "sessionId": request.sessionId
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/{user_id}/{session_id}")
async def get_history(
    user_id: str,
    session_id: str,
    authorized: bool = Depends(verify_internal_api_key)
):
    """Retrieve chat history"""
    try:
        history = context_manager.get_session_history(user_id, session_id)
        return {
            "success": True,
            "history": history,
            "count": len(history)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="warning"
    )