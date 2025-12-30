import os
from typing import Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

class LLMClient:
    """Handles OpenAI GPT-4 API for production-grade responses"""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "your_openai_api_key_here":
            raise ValueError("OPENAI_API_KEY not set in .env file")
        
        # Use GPT-4-0613 with optimized token allocation
        self.client = ChatOpenAI(
            model="gpt-4-0613",
            api_key=api_key,
            temperature=0.7,
            max_tokens=2000,  # Reduced from 3000 to 2000
            request_timeout=120
        )
        print("✅ Using OpenAI GPT-4-0613 (Production Mode)")
    
    async def generate(
        self, 
        system_prompt: str, 
        user_message: str,
        chat_history: Optional[list] = None
    ) -> str:
        """Generate executable investment strategy"""
        try:
            messages = [SystemMessage(content=system_prompt)]
            
            # Only include last 2 exchanges (4 messages) to save tokens
            if chat_history:
                for msg in chat_history[-4:]:  # Reduced from -8 to -4
                    if msg["role"] == "user":
                        messages.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        messages.append(AIMessage(content=msg["content"]))
            
            messages.append(HumanMessage(content=user_message))
            
            print(f"   📤 Sending to GPT-4 ({len(messages)} messages)")
            response = await self.client.ainvoke(messages)
            print(f"   📥 Response received ({len(response.content)} chars)")
            
            return response.content
            
        except Exception as e:
            print(f"❌ GPT-4 API Error: {str(e)}")
            raise Exception(f"Failed to generate strategy: {str(e)}")