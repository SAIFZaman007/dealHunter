"""
Simplified Google Custom Search Engine for Property Discovery
Uses ONLY Google CSE with entire web enabled
"""

import os
import aiohttp
import json
import re
from typing import List, Dict, Optional
from datetime import datetime
import asyncio

class GoogleCSEPropertySearch:
    """
    Simplified property search using Google Custom Search Engine
    Designed for entire web search mode
    """
    
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.google_cse_id = os.getenv("GOOGLE_CSE_ID")
        
        if not self.google_api_key or not self.google_cse_id:
            raise ValueError("❌ GOOGLE_API_KEY and GOOGLE_CSE_ID required in .env")
        
        print("✅ Google CSE Property Search Initialized")
    
    async def search_properties(
        self,
        location: str,
        property_type: str = "land",
        max_price: Optional[int] = None
    ) -> List[Dict]:
        """
        Search for properties using Google CSE
        
        Returns list of properties with: address, price, acres, source_url
        """
        
        print(f"\n🔍 GOOGLE CSE PROPERTY SEARCH")
        print(f"   Location: {location}")
        print(f"   Type: {property_type}")
        if max_price:
            print(f"   Max Price: ${max_price:,}")
        
        results = []
        
        # Build multiple queries to cast wide net
        queries = self._build_search_queries(location, property_type, max_price)
        
        for query_idx, query in enumerate(queries[:5], 1):  # Try up to 5 queries
            print(f"\n📋 Query {query_idx}: '{query}'")
            
            try:
                page_results = await self._execute_cse_query(query, max_results=20)
                results.extend(page_results)
                print(f"   ✅ Found {len(page_results)} results")
                
                # Stop if we have enough
                if len(results) >= 15:
                    print(f"   (Stopping - sufficient results gathered)")
                    break
                
                await asyncio.sleep(0.5)  # Rate limit
            
            except Exception as e:
                print(f"   ❌ Query failed: {str(e)[:100]}")
                continue
        
        # Remove duplicates and clean
        unique_results = self._deduplicate_results(results)
        
        print(f"\n✅ SEARCH COMPLETE")
        print(f"   Total Found: {len(unique_results)} unique properties")
        
        return unique_results[:25]  # Return top 25
    
    def _build_search_queries(
        self,
        location: str,
        property_type: str,
        max_price: Optional[int]
    ) -> List[str]:
        """Build diverse queries to find properties"""
        
        price_suffix = f" under ${max_price:,}" if max_price else ""
        
        queries = [
            # Query 1: Direct listing search with year
            f'"{location}" {property_type} for sale 2024 2025',
            
            # Query 2: MLS platforms
            f'{location} {property_type} listing mls OR zillow OR realtor OR redfin',
            
            # Query 3: Available now
            f'{location} {property_type} available now{price_suffix}',
            
            # Query 4: County + property type
            f'{location} county {property_type} property{price_suffix}',
            
            # Query 5: Shorthand property keywords
            f'{location} "{property_type} for sale"',
        ]
        
        return queries
    
    async def _execute_cse_query(
        self,
        query: str,
        max_results: int = 20
    ) -> List[Dict]:
        """Execute single Google CSE query"""
        
        url = "https://www.googleapis.com/customsearch/v1"
        
        params = {
            "key": self.google_api_key,
            "cx": self.google_cse_id,
            "q": query,
            "num": min(10, max_results),  # Max 10 per API call
            "gl": "us",
            "lr": "lang_en",
        }
        
        results = []
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"HTTP {response.status}: {error_text[:200]}")
                    
                    data = await response.json()
                    
                    if 'error' in data:
                        error_msg = data['error'].get('message', 'Unknown error')
                        raise Exception(f"CSE API Error: {error_msg}")
                    
                    if 'items' not in data:
                        print(f"   ⚠️  No results in response")
                        return results
                    
                    # Parse each result
                    for item in data.get('items', []):
                        title = item.get('title', '')
                        snippet = item.get('snippet', '')
                        link = item.get('link', '')
                        domain = item.get('displayLink', '')
                        
                        # Try to extract property data
                        prop_data = self._extract_property_data(
                            title=title,
                            snippet=snippet,
                            link=link,
                            domain=domain
                        )
                        
                        if prop_data:
                            results.append(prop_data)
        
        except asyncio.TimeoutError:
            print(f"   ❌ Request timeout")
        except Exception as e:
            print(f"   ❌ API Error: {str(e)[:150]}")
        
        return results
    
    def _extract_property_data(
        self,
        title: str,
        snippet: str,
        link: str,
        domain: str
    ) -> Optional[Dict]:
        """
        Extract property information from search result
        LENIENT: Accept partial matches, not just perfect addresses
        """
        
        combined_text = f"{title} {snippet}".lower()
        full_text = title + " " + snippet
        
        # FILTER 1: Must contain property indicators
        property_keywords = [
            'property', 'land', 'home', 'house', 'listing',
            'for sale', 'acre', 'lot', 'real estate',
            'residential', 'commercial', 'address'
        ]
        
        has_property_keyword = any(
            keyword in combined_text for keyword in property_keywords
        )
        
        if not has_property_keyword:
            return None
        
        # FILTER 2: Reject obvious non-property pages
        reject_keywords = [
            'blog', 'article', 'news', 'guide', 'how to',
            'calculator', 'map', 'search', 'directory',
            'email', 'phone', 'contact'
        ]
        
        if any(keyword in combined_text for keyword in reject_keywords):
            # Some of these can still have listings, but lower confidence
            pass
        
        # EXTRACTION 1: Try to find address (multiple patterns)
        address = self._extract_address(full_text)
        
        # EXTRACTION 2: Try to find price
        price = self._extract_price(full_text)
        
        # EXTRACTION 3: Try to find lot size
        acres = self._extract_acres(full_text)
        
        # DECISION: Need at least address OR (price AND acres)
        # Don't require perfect address match
        if not address and not (price and acres):
            return None  # Too little info
        
        # Build result
        result = {
            'title': title[:100],
            'address': address or f"{domain} listing",  # Fallback
            'price': price,
            'acres': acres,
            'property_type': self._determine_property_type(combined_text),
            'source': self._identify_source(domain),
            'source_url': link,
            'description': snippet[:200],
            'confidence': self._calculate_confidence(address, price, acres),
            'found_at': datetime.utcnow().isoformat()
        }
        
        return result
    
    def _extract_address(self, text: str) -> Optional[str]:
        """Extract property address from text"""
        
        patterns = [
            # Pattern 1: Standard street address
            r'\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Boulevard|Way|Pkwy|Pl|Place|Loop|Cir|Circle)',
            
            # Pattern 2: Address with city
            r'\d{1,5}\s+[A-Za-z\s]+,\s+[A-Z]{2}',
            
            # Pattern 3: Just numbered lot with location
            r'(?:Lot|Property|Address)[\s:]+[\w\s,]+(?:TX|Texas|FL|Florida|CA|California)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                address = match.group(0).strip()
                if len(address) > 10:  # Reasonable length
                    return address
        
        return None
    
    def _extract_price(self, text: str) -> int:
        """Extract price from text"""
        
        patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)',  # $200,000 or $200,000.00
            r'\$(\d{3,})',  # $200000
            r'(\d+),(\d{3})\s*(?:dollars|USD)',  # 200,000 dollars
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    price_str = match.group(1).replace(',', '')
                    price = int(float(price_str))
                    if price > 1000:  # Reasonable property price
                        return price
                except (ValueError, AttributeError):
                    continue
        
        return 0
    
    def _extract_acres(self, text: str) -> Optional[float]:
        """Extract lot size in acres"""
        
        patterns = [
            r'([\d.]+)\s*acres?(?:\s|$)',
            r'(?:lot size|property size)[\s:]*([0-9.]+)\s*acres?',
            r'([\d.]+)\s*(?:ac|acre)(?:\s|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    acres = float(match.group(1))
                    if 0.1 < acres < 1000:  # Reasonable lot size
                        return acres
                except (ValueError, IndexError):
                    continue
        
        return None
    
    def _determine_property_type(self, text: str) -> str:
        """Determine property type from text"""
        
        if 'land' in text or 'vacant' in text:
            return 'Land'
        elif 'commercial' in text or 'retail' in text:
            return 'Commercial'
        elif 'apartment' in text or 'multi' in text or 'multifamily' in text:
            return 'Multifamily'
        else:
            return 'Residential'
    
    def _identify_source(self, domain: str) -> str:
        """Identify property source from domain"""
        
        domain_lower = domain.lower()
        
        sources = {
            'zillow': 'Zillow',
            'realtor.com': 'Realtor.com',
            'redfin': 'Redfin',
            'landwatch': 'LandWatch',
            'loopnet': 'LoopNet',
            'facebook': 'Facebook',
            'craigslist': 'Craigslist',
            'trulia': 'Trulia',
            'mls': 'MLS',
            'county': 'County Records'
        }
        
        for key, name in sources.items():
            if key in domain_lower:
                return name
        
        # Return domain name
        return domain.split('.')[0].title()
    
    def _calculate_confidence(
        self,
        address: Optional[str],
        price: int,
        acres: Optional[float]
    ) -> str:
        """Calculate confidence level of extraction"""
        
        score = 0
        
        if address and len(address) > 15:
            score += 40
        elif address:
            score += 20
        
        if price > 0:
            score += 40
        
        if acres:
            score += 20
        
        if score >= 80:
            return 'High'
        elif score >= 50:
            return 'Medium'
        else:
            return 'Low'
    
    def _deduplicate_results(self, results: List[Dict]) -> List[Dict]:
        """Remove duplicate properties"""
        
        seen = {}
        unique = []
        
        for result in results:
            address = result.get('address', '').lower().strip()
            price = result.get('price', 0)
            
            # Create identifier (normalize address)
            address_normalized = re.sub(r'\s+', ' ', address)
            key = f"{address_normalized}|{price}"
            
            if key not in seen:
                seen[key] = True
                unique.append(result)
        
        return unique