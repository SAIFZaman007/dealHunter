"""Context Manager with Search Result Storage"""

from typing import Dict, Optional, List
from datetime import datetime
import json

class ContextManager:
    """Manages user profiles, sessions, and search results"""
    
    def __init__(self):
        self.contexts: Dict[str, Dict] = {}
    
    def _ensure_numeric(self, value) -> float:
        """Convert string numbers to float"""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                clean = value.replace('$', '').replace(',', '').strip()
                return float(clean) if clean else 0.0
            except (ValueError, AttributeError):
                return 0.0
        return 0.0
    
    def set_user_context(self, user_id: str, profile: Dict):
        """Store user profile from onboarding"""
        if user_id not in self.contexts:
            self.contexts[user_id] = {
                "profile": {},
                "sessions": {},
                "created_at": datetime.utcnow().isoformat()
            }
        
        # Normalize numeric fields
        normalized_profile = profile.copy()
        
        if 'startingCapital' in normalized_profile:
            normalized_profile['startingCapital'] = self._ensure_numeric(
                normalized_profile['startingCapital']
            )
        
        if 'profitGoal' in normalized_profile:
            normalized_profile['profitGoal'] = self._ensure_numeric(
                normalized_profile['profitGoal']
            )
        
        self.contexts[user_id]["profile"] = normalized_profile
        print(f"✅ Profile saved for user: {user_id}")
        print(f"📊 Profile: Capital=${normalized_profile.get('startingCapital', 0):,.2f}, Goal=${normalized_profile.get('profitGoal', 0):,.2f}")
    
    def get_user_context(self, user_id: str) -> Optional[Dict]:
        """Get user's context"""
        return self.contexts.get(user_id)
    
    def create_session(self, user_id: str, session_id: str, agent_type: str):
        """Create a new chat session"""
        if user_id not in self.contexts:
            self.set_user_context(user_id, {})
        
        self.contexts[user_id]["sessions"][session_id] = {
            "agent_type": agent_type,
            "messages": [],
            "extracted_data": {},
            "last_search_results": None,  # Store search results here
            "created_at": datetime.utcnow().isoformat()
        }
        print(f"✅ Session created: {session_id}")
    
    def store_search_results(self, user_id: str, session_id: str, search_results: List[Dict]):
        """Store search results for file generation"""
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            self.contexts[user_id]["sessions"][session_id]["last_search_results"] = search_results
            print(f"💾 Stored {len(search_results)} search results for session {session_id}")
    
    def get_search_results(self, user_id: str, session_id: str) -> Optional[List[Dict]]:
        """Retrieve stored search results"""
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            return self.contexts[user_id]["sessions"][session_id].get("last_search_results")
        return None
    
    def add_message(self, user_id: str, session_id: str, role: str, content: str):
        """Add message and extract key data"""
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            session = self.contexts[user_id]["sessions"][session_id]
            
            session["messages"].append({
                "role": role,
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            if role == "user":
                self._extract_and_store_data(user_id, session_id, content)
    
    def _extract_and_store_data(self, user_id: str, session_id: str, message: str):
        """Extract structured data from user messages"""
        session = self.contexts[user_id]["sessions"][session_id]
        extracted = session.get("extracted_data", {})
        
        import re
        
        # Extract capital
        capital_match = re.search(r'\$?(\d{1,3}(?:,?\d{3})*(?:\.\d{2})?)\s*(?:k|thousand)?', message, re.IGNORECASE)
        if capital_match:
            amount_str = capital_match.group(1).replace(',', '')
            amount = float(amount_str)
            if 'k' in message.lower() or 'thousand' in message.lower():
                amount *= 1000
            extracted['capital'] = amount
            print(f"💰 Extracted capital: ${amount:,.2f}")
        
        # Extract location
        location_keywords = ['county', 'city', 'in ', 'near', 'around', 'SC', 'TX', 'FL', 'CA', 'GA']
        for keyword in location_keywords:
            if keyword in message:
                words = message.split()
                for i, word in enumerate(words):
                    if keyword.lower() in word.lower():
                        start = max(0, i-2)
                        end = min(len(words), i+3)
                        extracted['location'] = ' '.join(words[start:end])
                        print(f"📍 Extracted location: {extracted['location']}")
                        break
        
        # Extract timeline
        timeline_match = re.search(r'(\d+)\s*(month|year|week)', message, re.IGNORECASE)
        if timeline_match:
            extracted['timeline'] = timeline_match.group(0)
            print(f"⏰ Extracted timeline: {extracted['timeline']}")
        
        # Extract profit goal
        profit_match = re.search(r'profit.*?\$?(\d{1,3}(?:,?\d{3})*)', message, re.IGNORECASE)
        if profit_match:
            extracted['profit_goal'] = float(profit_match.group(1).replace(',', ''))
            print(f"🎯 Extracted profit goal: ${extracted['profit_goal']:,.2f}")
        
        session["extracted_data"] = extracted
    
    def get_session_history(self, user_id: str, session_id: str) -> List[Dict]:
        """Get all messages in a session"""
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            return self.contexts[user_id]["sessions"][session_id]["messages"]
        return []
    
    def get_full_context(self, user_id: str, session_id: str) -> str:
        """Build comprehensive context string"""
        context_parts = []
        
        # User Profile
        if user_id in self.contexts:
            profile = self.contexts[user_id].get("profile", {})
            if profile:
                context_parts.append("# USER PROFILE")
                context_parts.append(f"- Property Type: {profile.get('propertyType', 'Not specified')}")
                context_parts.append(f"- Strategy: {profile.get('strategy', 'Not specified')}")
                
                capital = self._ensure_numeric(profile.get('startingCapital', 0))
                profit = self._ensure_numeric(profile.get('profitGoal', 0))
                
                context_parts.append(f"- Starting Capital: ${capital:,.2f}")
                context_parts.append(f"- Target Geography: {profile.get('targetGeography', 'Not specified')}")
                context_parts.append(f"- Timeline: {profile.get('investmentTimeline', 'Not specified')}")
                context_parts.append(f"- Profit Goal: ${profit:,.2f}")
                context_parts.append("")
        
        # Extracted Data
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            extracted = self.contexts[user_id]["sessions"][session_id].get("extracted_data", {})
            if extracted:
                context_parts.append("# EXTRACTED FROM CONVERSATION")
                for key, value in extracted.items():
                    if key in ['capital', 'profit_goal']:
                        num_val = self._ensure_numeric(value)
                        context_parts.append(f"- {key.replace('_', ' ').title()}: ${num_val:,.2f}")
                    else:
                        context_parts.append(f"- {key.replace('_', ' ').title()}: {value}")
                context_parts.append("")
        
        # Recent History
        history = self.get_session_history(user_id, session_id)
        if history:
            context_parts.append("# RECENT CONVERSATION")
            for msg in history[-6:]:
                role = msg['role'].upper()
                content = msg['content'][:200]
                context_parts.append(f"[{role}]: {content}")
            context_parts.append("")
        
        context_parts.append("# INSTRUCTIONS")
        context_parts.append("- USE PROVIDED DATA ONLY")
        context_parts.append("- DO NOT INVENT ADDRESSES OR PRICES")
        context_parts.append("- CITE SOURCES FOR SEARCH RESULTS")
        context_parts.append("- REMEMBER ALL CONVERSATION CONTEXT")
        
        return "\n".join(context_parts)