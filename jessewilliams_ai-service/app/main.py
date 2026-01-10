"""FastAPI Main with Integrated File Generation"""

from fastapi.responses import Response, JSONResponse
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Optional
from contextlib import asynccontextmanager
import os
import json
import base64
from dotenv import load_dotenv

load_dotenv()

from app.core.security import verify_internal_api_key

# Global variables
context_manager = None
deal_hunter_agent = None
file_generation_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global context_manager, deal_hunter_agent, file_generation_service
    
    print("🚀 AI Service Starting...")
    
    from app.core.context import ContextManager
    from app.agents.deal_hunter import DealHunterAgent
    from app.utils.file_generator import FileGenerationService
    
    context_manager = ContextManager()
    deal_hunter_agent = DealHunterAgent(context_manager)
    file_generation_service = FileGenerationService()
    
    print(f"✅ Ready on http://localhost:8000")
    print(f"🔒 Auth: {'Configured' if os.getenv('INTERNAL_API_SECRET') else 'Missing'}")
    print(f"✴ LLM: OpenAI GPT-5.2")
    print(f"📁 File Generation: Enabled\n")
    
    yield
    
    print("👋 AI Service Shutting Down...")

app = FastAPI(
    title="AI Real Estate Investment Assistant",
    version="2.0.0",
    description="Production-grade AI with memory and file generation",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://deal-hunter-delta.vercel.app",
        "https://jessewilliamnew-server.mtscorporate.com",
        "http://localhost:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models with Pydantic V2
class UserProfile(BaseModel):
    propertyType: str
    strategy: str
    rentalType: Optional[str] = None
    startingCapital: float
    targetGeography: str
    investmentTimeline: str
    profitGoal: float
    
    @field_validator('startingCapital', 'profitGoal', mode='before')
    @classmethod
    def convert_to_float(cls, v):
        """Convert string numbers to float"""
        if v is None:
            return 0.0
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                clean = v.replace('$', '').replace(',', '').strip()
                return float(clean) if clean else 0.0
            except (ValueError, AttributeError):
                return 0.0
        return 0.0

class ChatMessage(BaseModel):
    userId: str
    sessionId: str
    message: str
    agentType: str = "deal-hunter"
    userProfile: Optional[dict] = None
    
    @field_validator('userProfile', mode='before')
    @classmethod
    def normalize_profile(cls, v):
        """Normalize userProfile numeric fields"""
        if not v:
            return v
        
        normalized = v.copy()
        
        for field in ['startingCapital', 'profitGoal']:
            if field in normalized:
                val = normalized[field]
                if isinstance(val, str):
                    try:
                        clean = val.replace('$', '').replace(',', '').strip()
                        normalized[field] = float(clean) if clean else 0.0
                    except (ValueError, AttributeError):
                        normalized[field] = 0.0
                elif val is None:
                    normalized[field] = 0.0
        
        return normalized

class OnboardingRequest(BaseModel):
    userId: str
    profile: UserProfile

# Routes
@app.get("/")
async def root():
    return {
        "service": "AI Real Estate Investment Assistant",
        "status": "running",
        "version": "2.0.0",
        "features": ["memory", "file_generation", "web_search", "type_validation"]
    }

@app.get("/health")
async def health():
    return {
        "status": "HEALTHY",
        "service": "AI-Service",
        "llm_provider": "OpenAI GPT-4o-mini",
        "memory": "enabled",
        "file_generation": "enabled"
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(
    request: ChatMessage,
    authorized: bool = Depends(verify_internal_api_key)
):
    """
    Handle chat with memory and intelligent file generation
    
    CRITICAL FIX: Return JSON with base64-encoded file data instead of binary Response
    """
    try:
        # Store profile if provided
        if request.userProfile:
            context_manager.set_user_context(
                user_id=request.userId,
                profile=request.userProfile
            )
        
        # Get or create user context
        user_context = context_manager.get_user_context(request.userId)
        if not user_context:
            context_manager.set_user_context(request.userId, {})
            user_context = context_manager.get_user_context(request.userId)
        
        # Create session if needed
        if request.sessionId not in user_context.get("sessions", {}):
            context_manager.create_session(
                request.userId,
                request.sessionId,
                request.agentType
            )
        
        # Get user profile
        user_profile = user_context.get("profile", {})
        
        # Process message with agent (includes web search)
        print("🧠 Processing message with Deal Hunter agent...")
        response_text = await deal_hunter_agent.process_message(
            request.userId,
            request.sessionId,
            request.message,
            user_profile if user_profile else None
        )
        
        # Get search results from context
        search_results = context_manager.get_search_results(request.userId, request.sessionId)
        
        # Check if file should be generated
        should_generate, file_type = file_generation_service.should_generate_file(
            request.message,
            response_text
        )
        
        if should_generate and file_type:
            print(f"📁 File generation requested: {file_type}")
            
            try:
                # Extract all data for file generation
                file_data = file_generation_service.extract_data_from_context(
                    user_context,
                    request.sessionId,
                    search_results
                )
                
                # Generate file
                if file_type == 'excel':
                    file_content, filename = file_generation_service.generate_excel(file_data)
                    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                
                elif file_type == 'word':
                    file_content, filename = file_generation_service.generate_word(file_data)
                    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                
                elif file_type == 'powerpoint':
                    file_content, filename = file_generation_service.generate_powerpoint(file_data)
                    media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                
                else:
                    raise ValueError(f"Unknown file type: {file_type}")
                
                print(f"✅ Generated {filename} ({len(file_content)} bytes)")
                
                #Generate concise response text
                concise_response = file_generation_service.generate_file_response_text(file_data, file_type)
                
                #Return JSON with base64-encoded file
                file_base64 = base64.b64encode(file_content).decode('utf-8')
                
                return JSONResponse(content={
                    "success": True,
                    "response": response_text,
                    "sessionId": request.sessionId,
                    "fileGenerated": True,
                    "file": {
                        "name": filename,
                        "data": file_base64,
                        "mimeType": media_type
                    }
                })
                
            except Exception as e:
                print(f"⚠️ File generation error: {e}")
                import traceback
                traceback.print_exc()
                
                # Return text response with error note
                response_text += f"\n\n---\n\n⚠️ File generation encountered an issue: {str(e)}\n\nPlease ensure you've provided all necessary information."
        
        # Return standard text response
        return {
            "success": True,
            "response": response_text,
            "sessionId": request.sessionId,
            "fileGenerated": False
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