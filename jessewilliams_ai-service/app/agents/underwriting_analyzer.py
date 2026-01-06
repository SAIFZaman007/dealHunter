"""Underwriting Analyzer Agent - Financial Analysis Specialist"""

import os
from openai import OpenAI
from app.prompts.underwriting_prompt import UNDERWRITING_PROMPT
from app.prompts.core_prompt import CORE_SYSTEM_INSTRUCTIONS, build_context
from app.utils.formatters import ResponseFormatter

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class UnderwritingAnalyzerAgent:
    """Financial analysis specialist for deal underwriting"""
    
    def __init__(self):
        self.formatter = ResponseFormatter()
        print("✅ Underwriting Analyzer Agent Ready")
    
    async def process_message(
        self,
        user_id: str,
        session_id: str,
        message: str,
        user_profile: dict = None
    ) -> str:
        """Process financial analysis requests"""
        
        # Build context
        context = build_context(user_profile) if user_profile else ""
        system_prompt = f"{CORE_SYSTEM_INSTRUCTIONS}\n\n{context}\n\n{UNDERWRITING_PROMPT}"
        
        # Get varied greeting
        greetings = ["Analyzing now!", "Crunching numbers!", "Running analysis!", "Calculating!", "On it!"]
        import random
        greeting = random.choice(greetings)
        
        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            temperature=0.7,
            max_completion_tokens=2500
        )
        
        ai_response = response.choices[0].message.content
        
        # Replace generic greeting
        for generic in ["Understood", "Got it", "Perfect"]:
            if ai_response.startswith(generic):
                ai_response = ai_response.replace(generic, greeting, 1)
                break
        
        return ai_response