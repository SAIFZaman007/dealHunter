"""LLM Client with Web Search Integration"""

import os
from typing import Optional, List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import aiohttp
from bs4 import BeautifulSoup
import json

class LLMClient:
    """Production LLM client with web search capabilities"""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        
        self.client = ChatOpenAI(
            model="gpt-5.2",  # Using latest efficient model
            api_key=api_key,
            temperature=0.7,
            max_completion_tokens=2500,
            request_timeout=120
        )
        
        # Web search configuration
        self.search_apis = {
            'zillow_rapid': os.getenv("RAPID_API_KEY"),  # RapidAPI for Zillow
            'serp_api': os.getenv("SERP_API_KEY")  # For general search
        }
        
        print("✅ LLM Client with Web Search Ready")
    
    async def search_property_listings(
        self,
        location: str,
        max_price: int = None,
        property_type: str = "land"
    ) -> List[Dict]:
        """
        Search for property listings using available APIs
        Simulates Zillow, LandWatch, Realtor.com searches
        """
        
        print(f"🔍 Searching {property_type} in {location} under ${max_price or 'any price'}...")
        
        # In production, use real APIs. For now, simulate structure
        # that would come from Zillow/LandWatch/Realtor APIs
        
        results = []
        
        # Simulated API response structure
        # In production, replace with actual API calls
        sources = await self._fetch_from_multiple_sources(
            location, max_price, property_type
        )
        
        return sources
    
    async def _fetch_from_multiple_sources(
        self,
        location: str,
        max_price: int,
        property_type: str
    ) -> List[Dict]:
        """Fetch from multiple property listing sources"""
        
        sources = []
        
        # Source 1: Zillow (via RapidAPI or direct if available)
        zillow_results = await self._search_zillow(location, max_price, property_type)
        if zillow_results:
            sources.extend(zillow_results)
        
        # Source 2: LandWatch (for land specifically)
        if property_type == "land":
            landwatch_results = await self._search_landwatch(location, max_price)
            if landwatch_results:
                sources.extend(landwatch_results)
        
        # Source 3: Realtor.com
        realtor_results = await self._search_realtor(location, max_price, property_type)
        if realtor_results:
            sources.extend(realtor_results)
        
        return sources
    
    async def _search_zillow(
        self,
        location: str,
        max_price: int,
        property_type: str
    ) -> List[Dict]:
        """Search Zillow via RapidAPI or web scraping"""
        
        # If RapidAPI key available, use it
        if self.search_apis.get('zillow_rapid'):
            return await self._zillow_api_search(location, max_price)
        
        # Otherwise, return structure that would come from search
        # In production, implement actual scraping or API call
        return []
    
    async def _zillow_api_search(self, location: str, max_price: int) -> List[Dict]:
        """Use RapidAPI Zillow endpoint"""
        
        url = "https://zillow-com1.p.rapidapi.com/propertyExtendedSearch"
        
        headers = {
            "X-RapidAPI-Key": self.search_apis['zillow_rapid'],
            "X-RapidAPI-Host": "zillow-com1.p.rapidapi.com"
        }
        
        querystring = {
            "location": location,
            "price_max": max_price,
            "status_type": "ForSale",
            "home_type": "Land"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=querystring) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._format_zillow_results(data)
        except Exception as e:
            print(f"⚠️ Zillow API error: {e}")
        
        return []
    
    def _format_zillow_results(self, raw_data: Dict) -> List[Dict]:
        """Format Zillow API response to standard structure"""
        
        formatted = []
        
        for prop in raw_data.get('props', []):
            formatted.append({
                'source': 'Zillow',
                'source_url': f"https://www.zillow.com/homedetails/{prop.get('zpid', '')}",
                'address': prop.get('address', 'N/A'),
                'city': prop.get('city', 'N/A'),
                'state': prop.get('state', 'N/A'),
                'zip': prop.get('zipcode', 'N/A'),
                'price': prop.get('price', 0),
                'lot_size': prop.get('lotSize', 'N/A'),
                'description': prop.get('description', '')[:200]
            })
        
        return formatted
    
    async def _search_landwatch(self, location: str, max_price: int) -> List[Dict]:
        """Search LandWatch for land listings"""
        
        # Implement LandWatch API or scraping
        # Return formatted results
        return []
    
    async def _search_realtor(
        self,
        location: str,
        max_price: int,
        property_type: str
    ) -> List[Dict]:
        """Search Realtor.com"""
        
        # Implement Realtor.com API or scraping
        return []
    
    async def search_market_data(self, location: str) -> Dict:
        """Get general market data for area"""
        
        # Use SERP API to search for market trends
        if self.search_apis.get('serp_api'):
            query = f"{location} real estate market trends 2024"
            results = await self._serp_search(query)
            return results
        
        return {}
    
    async def _serp_search(self, query: str) -> Dict:
        """Use SerpAPI for general web search"""
        
        url = "https://serpapi.com/search"
        
        params = {
            "q": query,
            "api_key": self.search_apis['serp_api'],
            "num": 5
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception as e:
            print(f"⚠️ SERP API error: {e}")