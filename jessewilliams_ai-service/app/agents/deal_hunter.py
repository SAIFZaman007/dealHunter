"""
Deal Hunter Agent - Updated with Intent Classification & Streaming
"""

import os
from openai import OpenAI
from app.utils.prompts import (
    DEAL_HUNTER_SYSTEM_PROMPT,
    UNDERWRITING_ANALYZER_PROMPT,
    OFFER_OUTREACH_PROMPT
)
from app.core.intent_classifier import IntentClassifier

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class DealHunterAgent:
    def __init__(self):
        self.classifier = IntentClassifier()
        print("✅ Deal Hunter Agent initialized")
    
    def _build_context_message(self, user_profile: dict) -> str:
        """Build context from user profile"""
        if not user_profile:
            return ""
        
        return f"""
USER CONTEXT (Always reference this):
- Property Type: {user_profile.get('propertyType', 'Not specified')}
- Strategy: {user_profile.get('strategy', 'Not specified')}
- Rental Type: {user_profile.get('rentalType', 'N/A')}
- Starting Capital: ${user_profile.get('startingCapital', '0')}
- Target Geography: {user_profile.get('targetGeography', 'Not specified')}
- Investment Timeline: {user_profile.get('investmentTimeline', 'Not specified')}
- Profit Goal: ${user_profile.get('profitGoal', '0')}

IMPORTANT: Always use these values in your analysis. Do NOT ask for them again.
"""
    
    def _get_system_prompt(self, intent: str, user_profile: dict) -> str:
        """Get appropriate system prompt based on intent"""
        context = self._build_context_message(user_profile)
        
        prompts = {
            'deal_hunter': DEAL_HUNTER_SYSTEM_PROMPT,
            'underwriting_analyzer': UNDERWRITING_ANALYZER_PROMPT,
            'offer_outreach': OFFER_OUTREACH_PROMPT
        }
        
        base_prompt = prompts.get(intent, DEAL_HUNTER_SYSTEM_PROMPT)
        
        if context:
            return f"{context}\n\n{base_prompt}"
        return base_prompt
    
    async def process_message(
        self, 
        user_id: str, 
        session_id: str, 
        message: str,
        user_profile: dict = None
    ) -> str:
        """Process message with intent detection"""
        
        # Classify intent
        intent, confidence, metadata = self.classifier.classify(message)
        
        print(f"🎯 Intent: {intent} (confidence: {confidence:.2f})")
        print(f"   Matched: {metadata['matched_keywords'][:3]}")
        
        # Get appropriate system prompt
        system_prompt = self._get_system_prompt(intent, user_profile)
        
        # Get greeting based on intent
        greeting = self.classifier.get_agent_greeting(intent)
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=2000
        )
        
        ai_response = response.choices[0].message.content
        
        # Replace "Understood" with varied greeting
        if ai_response.startswith("Understood"):
            ai_response = ai_response.replace("Understood", greeting, 1)
        
        return ai_response
    
    async def process_message_stream(
        self,
        user_id: str,
        session_id: str,
        message: str,
        user_profile: dict = None
    ):
        """Process message with streaming response"""
        
        # Classify intent
        intent, confidence, metadata = self.classifier.classify(message)
        
        print(f"🎯 Intent: {intent} (confidence: {confidence:.2f})")
        
        # Get system prompt
        system_prompt = self._get_system_prompt(intent, user_profile)
        greeting = self.classifier.get_agent_greeting(intent)
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        # Stream response
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=True
        )
        
        # Yield greeting first
        yield f"data: {greeting}\n\n"
        
        # Stream chunks
        for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                # Skip "Understood" if it appears
                if not content.startswith("Understood"):
                    yield f"data: {content}\n\n"
        
        yield "data: [DONE]\n\n"