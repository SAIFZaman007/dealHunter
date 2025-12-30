from typing import Dict, Optional
from datetime import datetime

class ContextManager:
    """Manages user profiles and conversation sessions in memory"""
    
    def __init__(self):
        # In-memory storage (for production, you'd use Redis or database)
        self.contexts: Dict[str, Dict] = {}
    
    def set_user_context(self, user_id: str, profile: Dict):
        """Store user profile from onboarding"""
        if user_id not in self.contexts:
            self.contexts[user_id] = {
                "profile": {},
                "sessions": {},
                "created_at": datetime.utcnow().isoformat()
            }
        
        self.contexts[user_id]["profile"] = profile
        print(f"✅ Profile saved for user: {user_id}")
    
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
            "created_at": datetime.utcnow().isoformat()
        }
        print(f"✅ Session created: {session_id} for user: {user_id}")
    
    def add_message(self, user_id: str, session_id: str, role: str, content: str):
        """Add a message to the session history"""
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            self.contexts[user_id]["sessions"][session_id]["messages"].append({
                "role": role,
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            })
    
    def get_session_history(self, user_id: str, session_id: str) -> list:
        """Get all messages in a session"""
        if user_id in self.contexts and session_id in self.contexts[user_id]["sessions"]:
            return self.contexts[user_id]["sessions"][session_id]["messages"]
        return []
    
    def format_context_for_prompt(self, user_id: str) -> str:
        """Format user profile into a string for AI context"""
        context = self.get_user_context(user_id)
        if not context or not context.get("profile"):
            return ""
        
        profile = context["profile"]
        return f"""
User's Investment Profile:
- Property Type: {profile.get('propertyType', 'Not specified')}
- Strategy: {profile.get('strategy', 'Not specified')}
- Rental Type: {profile.get('rentalType', 'N/A')}
- Starting Capital: ${profile.get('startingCapital', 'Not specified'):,}
- Target Location: {profile.get('targetGeography', 'Not specified')}
- Timeline: {profile.get('investmentTimeline', 'Not specified')}
- Profit Goal: ${profile.get('profitGoal', 'Not specified'):,} """