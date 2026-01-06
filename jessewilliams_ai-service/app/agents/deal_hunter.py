"""
Deal Hunter Agent - With Search Result Storage for File Generation
"""

import os
from typing import Optional
from openai import OpenAI
from app.prompts.core_prompt import CORE_SYSTEM_INSTRUCTIONS, build_context
from app.prompts.deal_hunter_prompt import DEAL_HUNTER
from app.prompts.underwriting_prompt import UNDERWRITING_PROMPT
from app.prompts.offer_outreach_prompt import OFFER_OUTREACH_PROMPT
from app.core.intent_classifier import IntentClassifier
from app.core.context import ContextManager
from app.utils.formatters import ResponseFormatter

# Import web search
try:
    from app.core.web_search import WebSearchClient
    WEB_SEARCH_AVAILABLE = True
except ImportError:
    WEB_SEARCH_AVAILABLE = False
    print("⚠️ Web search module not available")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class DealHunterAgent:
    """Enhanced Deal Hunter with search result storage"""
    
    def __init__(self, context_manager: ContextManager):
        self.classifier = IntentClassifier()
        self.formatter = ResponseFormatter()
        self.context_manager = context_manager
        
        if WEB_SEARCH_AVAILABLE:
            self.search_client = WebSearchClient()
            print("✅ Deal Hunter Agent (Memory + Web Search) - Ready")
        else:
            self.search_client = None
            print("✅ Deal Hunter Agent (Memory Only) - Ready")
    
    def _get_greeting_response(self) -> str:
        """Generate appropriate greeting response"""
        return """Hello! I'm Deal Hunter, your real-estate investment assistant.

To begin, please confirm your preferred investment focus:

**Would you like to invest in:**

**1.** Land

**2.** Residential Real Estate

**3.** Commercial Real Estate

Please reply with **1**, **2**, or **3** to continue.

**Next Steps —**

**1.** Select asset class (Land / Residential / Commercial)

**2.** Confirm strategy type

**3.** Define capital, geography, timeline, and profit goal"""
    
    def _get_system_prompt(self, intent: str, profile: dict) -> str:
        """Build full system prompt with context"""
        context = build_context(profile) if profile else ""
        
        prompts = {
            'deal_hunter': DEAL_HUNTER,
            'underwriting_analyzer': UNDERWRITING_PROMPT,
            'offer_outreach': OFFER_OUTREACH_PROMPT
        }
        
        base = prompts.get(intent, DEAL_HUNTER)
        
        anti_hallucination = """

# CRITICAL: ANTI-HALLUCINATION RULES

1. **NEVER INVENT DATA**: Do not create property addresses, prices, or listings
2. **USE ONLY PROVIDED DATA**: Only use information from user profile, conversation history, or web search results
3. **ACKNOWLEDGE LIMITATIONS**: If you don't have specific data, say "I can search for current listings in [location]"
4. **NO ASSUMPTIONS**: Do not assume property details, market conditions, or specific opportunities
5. **CITE SOURCES**: When using web search results, always include source URLs as hyperlinks

## What to Do Instead:
- Provide STRATEGY frameworks (how to find deals)
- Explain FORMULAS and CALCULATIONS (70% rule, cap rate formulas)
- Describe PROCESSES (how to wholesale, how to analyze)
- Offer to SEARCH for actual listings when ready

## Citing Web Search Results:
When using search results, format like this:
"According to [Zillow](url), there are X properties available..."
"Based on search results, the average price is..."

## File Generation Support:
When user requests spreadsheets, documents, or files:
- Process the request normally
- Include all relevant data in your response
- The system will automatically generate downloadable files
- Mention: "I'll generate that file for you now."
"""
        
        return f"{CORE_SYSTEM_INSTRUCTIONS}\n\n{context}\n\n{base}\n\n{anti_hallucination}"
    
    def _should_search(self, message: str) -> bool:
        """Determine if web search is needed"""
        search_triggers = [
            'find', 'search', 'show', 'list', 'available',
            'current', 'what properties', 'what deals',
            'what listings', 'real estate in', 'properties in',
            'land in', 'homes in'
        ]
        return any(trigger in message.lower() for trigger in search_triggers)
    
    async def process_message(
        self,
        user_id: str,
        session_id: str,
        message: str,
        user_profile: dict = None
    ) -> str:
        """Process with search result storage"""
        
        # Store user message
        self.context_manager.add_message(user_id, session_id, "user", message)
        
        # Classify intent
        intent, confidence, meta = self.classifier.classify(message)
        print(f"🎯 Intent: {intent} ({confidence:.2f})")
        
        # Handle greeting
        if intent == 'greeting':
            print("👋 Greeting detected")
            response = self._get_greeting_response()
            self.context_manager.add_message(user_id, session_id, "assistant", response)
            return response
        
        # Check if web search needed
        search_results = None
        if self.search_client and self._should_search(message):
            print("🔍 Web search triggered")
            
            user_context = self.context_manager.get_user_context(user_id)
            if user_context:
                session = user_context.get("sessions", {}).get(session_id, {})
                extracted = session.get("extracted_data", {})
                
                location = extracted.get("location") or (user_profile.get("targetGeography") if user_profile else None)
                capital = extracted.get("capital") or (user_profile.get("startingCapital") if user_profile else None)
                
                if location:
                    try:
                        property_type = user_profile.get("propertyType", "land").lower() if user_profile else "land"
                        
                        search_results = await self.search_client.search_properties(
                            location=location,
                            property_type=property_type,
                            max_price=int(capital) if capital else None
                        )
                        
                        print(f"✅ Found {len(search_results)} properties")
                        
                        # IMPORTANT: Store search results in session context
                        if search_results:
                            self.context_manager.store_search_results(
                                user_id,
                                session_id,
                                search_results
                            )
                        
                    except Exception as e:
                        print(f"❌ Search error: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print("⚠️ No location found - skipping search")
        
        # Get FULL context
        full_context = self.context_manager.get_full_context(user_id, session_id)
        
        # Add search results to context
        if search_results:
            search_context = "\n\n# REAL WEB SEARCH RESULTS (USE THESE)\n\n"
            for i, result in enumerate(search_results[:10], 1):
                search_context += f"{i}. **{result['address']}**\n"
                search_context += f"   - Price: ${result['price']:,}\n"
                search_context += f"   - Type: {result.get('property_type', 'N/A')}\n"
                search_context += f"   - Source: [{result['source']}]({result['source_url']})\n"
                if result.get('lot_size'):
                    search_context += f"   - Lot Size: {result['lot_size']}\n"
                if result.get('sqft'):
                    search_context += f"   - Sq Ft: {result['sqft']:,}\n"
                if result.get('bedrooms'):
                    search_context += f"   - Beds/Baths: {result['bedrooms']}/{result['bathrooms']}\n"
                if result.get('is_sample'):
                    search_context += f"   - NOTE: Sample data (API unavailable)\n"
                search_context += "\n"
            
            search_context += "**CRITICAL**: Use ONLY these properties. Include source URLs.\n"
            full_context += search_context
        
        # Build prompt
        system_prompt = self._get_system_prompt(intent, user_profile)
        complete_system_prompt = f"{system_prompt}\n\n{full_context}"
        
        print(f"📝 Context: {len(full_context)} chars | Search: {len(search_results) if search_results else 0}")
        print(f"🧠 Sending to GPT-5.2...")
        
        # Get greeting
        greeting = self.formatter.get_greeting()
        
        # Call OpenAI
        history = self.context_manager.get_session_history(user_id, session_id)
        messages = [{"role": "system", "content": complete_system_prompt}]
        
        for msg in history[-8:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        try:
            response = client.chat.completions.create(
                model="gpt-5.2",
                messages=messages,
                temperature=0.7,
                max_completion_tokens=2500
            )
            
            ai_response = response.choices[0].message.content
            
            # Replace generic greeting
            for generic in ["Understood", "Got it", "Perfect", "Acknowledged"]:
                if ai_response.startswith(generic):
                    ai_response = ai_response.replace(generic, greeting, 1)
                    break
            
            # Store response
            self.context_manager.add_message(user_id, session_id, "assistant", ai_response)
            
            return ai_response
            
        except Exception as e:
            print(f"❌ OpenAI Error: {e}")
            import traceback
            traceback.print_exc()
            return f"I encountered an error: {str(e)}"