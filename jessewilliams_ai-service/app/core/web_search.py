"""
Web Search Client - Google CSE with Individual Property Extraction
"""

import os
import aiohttp
import json
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
import re
from datetime import datetime
import asyncio

class WebSearchClient:
    """
    Production web search with Google Custom Search API
    NOW EXTRACTS INDIVIDUAL PROPERTY ADDRESSES
    """
    
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.google_cse_id = os.getenv("GOOGLE_CSE_ID")
        self.search_provider = os.getenv("SEARCH_PROVIDER", "google_cse")
        
        print(f"🔍 Web Search Ready - Provider: {self.search_provider.upper()}")
        print(f"   - Google CSE: {'✅' if self.google_api_key and self.google_cse_id else '❌'}")
    
    async def search_properties(
        self,
        location: str,
        property_type: str = "land",
        max_price: Optional[int] = None,
        min_acres: Optional[float] = None
    ) -> List[Dict]:
        """
        Search for individual properties with EXACT ADDRESSES
        
        Strategy:
        1. Use Google CSE to find listing pages
        2. Fetch and scrape those pages for individual properties
        3. Extract exact addresses, prices, details
        """
        
        print(f"🔍 Searching: {property_type} in {location}")
        if max_price:
            print(f"   Max Price: ${max_price:,}")
        
        results = []
        
        # Use multiple search strategies to find individual listings
        if self.google_api_key and self.google_cse_id:
            # Strategy 1: Search for individual listings (not aggregate pages)
            individual_results = await self._search_individual_listings(
                location, property_type, max_price
            )
            results.extend(individual_results)
            
            # Strategy 2: If few results, fetch aggregate pages and extract
            if len(results) < 5:
                print("   📄 Fetching aggregate pages for more listings...")
                aggregate_results = await self._fetch_from_aggregate_pages(
                    location, property_type, max_price
                )
                results.extend(aggregate_results)
        
        # Deduplicate
        unique_results = self._deduplicate_results(results)
        
        print(f"✅ Found {len(unique_results)} properties with addresses")
        return unique_results[:20]
    
    async def _search_individual_listings(
        self,
        location: str,
        property_type: str,
        max_price: Optional[int]
    ) -> List[Dict]:
        """
        Search specifically for individual property listings
        Uses targeted queries to find pages with actual addresses
        """
        
        print("🎯 Strategy 1: Searching for individual listings...")
        
        # Build highly specific queries to find individual properties
        queries = self._build_individual_listing_queries(location, property_type, max_price)
        
        all_results = []
        
        for query in queries[:3]:  # Try top 3 query variations
            url = "https://www.googleapis.com/customsearch/v1"
            
            params = {
                "key": self.google_api_key,
                "cx": self.google_cse_id,
                "q": query,
                "num": 10,
                "gl": "us",
                "lr": "lang_en"
            }
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url, 
                        params=params, 
                        timeout=aiohttp.ClientTimeout(total=15)
                    ) as response:
                        
                        if response.status == 200:
                            data = await response.json()
                            
                            if 'error' in data:
                                continue
                            
                            # Parse results - focus on those with addresses in title
                            page_results = self._parse_individual_listings(data, location)
                            all_results.extend(page_results)
                            
                            print(f"   ✅ Query '{query[:50]}...': {len(page_results)} properties")
                            
                            # Don't overwhelm API
                            await asyncio.sleep(0.5)
            
            except Exception as e:
                print(f"   ⚠️ Query failed: {e}")
                continue
        
        return all_results
    
    def _build_individual_listing_queries(
        self,
        location: str,
        property_type: str,
        max_price: Optional[int]
    ) -> List[str]:
        """
        Build queries specifically designed to find individual property listings
        """
        
        # Extract city/county from location
        location_parts = location.split(',')
        city_county = location_parts[0].strip() if location_parts else location
        
        queries = []
        
        # Query 1: Address-focused with price
        if max_price:
            queries.append(f'"{city_county}" address {property_type} for sale ${max_price//1000}k')
        else:
            queries.append(f'"{city_county}" address {property_type} for sale')
        
        # Query 2: Street address pattern
        queries.append(f'"{city_county}" "Rd" OR "St" OR "Ave" {property_type} for sale')
        
        # Query 3: Listing-specific with address
        queries.append(f'"{city_county}" lot OR parcel address {property_type} zillow realtor')
        
        # Query 4: Direct listings
        queries.append(f'{city_county} {property_type} listing address price')
        
        # Query 5: With ZIP code pattern
        state = location_parts[1].strip() if len(location_parts) > 1 else ""
        if state:
            queries.append(f'"{city_county}" {state} {property_type} for sale site:zillow.com OR site:realtor.com')
        
        return queries
    
    def _parse_individual_listings(self, data: Dict, location: str) -> List[Dict]:
        """
        Parse search results, filtering for those with actual addresses
        """
        
        results = []
        
        for item in data.get('items', []):
            title = item.get('title', '')
            snippet = item.get('snippet', '')
            link = item.get('link', '')
            display_link = item.get('displayLink', '')
            
            # Check if result contains address indicators
            has_address = self._contains_address_pattern(title + ' ' + snippet)
            
            if not has_address:
                continue  # Skip aggregate pages
            
            # Extract property details
            property_data = self._extract_property_details(
                title, 
                snippet, 
                link, 
                location
            )
            
            if property_data and property_data.get('address'):
                # Verify address looks real (not "Property in Travis County")
                address = property_data['address']
                if self._is_valid_address(address):
                    property_data.update({
                        'source': self._identify_source(display_link, link),
                        'source_url': link,
                        'search_date': datetime.utcnow().isoformat()
                    })
                    results.append(property_data)
        
        return results
    
    def _contains_address_pattern(self, text: str) -> bool:
        """
        Check if text contains street address patterns
        """
        
        # Street indicators
        street_suffixes = ['Rd', 'Road', 'St', 'Street', 'Ave', 'Avenue', 'Dr', 'Drive', 
                          'Ln', 'Lane', 'Ct', 'Court', 'Blvd', 'Boulevard', 'Way', 
                          'Pkwy', 'Parkway', 'Pl', 'Place', 'Loop', 'Cir', 'Circle']
        
        # Check for number + street name pattern
        address_pattern = r'\d+\s+[A-Z][a-z]+\s+(?:' + '|'.join(street_suffixes) + r')'
        
        if re.search(address_pattern, text):
            return True
        
        # Check for "LOT" pattern
        if re.search(r'LOT\s+\d+', text, re.IGNORECASE):
            return True
        
        # Check for # pattern (unit numbers)
        if re.search(r'#\d+', text):
            return True
        
        return False
    
    def _is_valid_address(self, address: str) -> bool:
        """
        Verify address looks like a real street address
        """
        
        # Invalid patterns
        invalid_patterns = [
            r'^property in',
            r'^land in',
            r'^homes? in',
            r'^\d+\s*listing',
            r'^search',
            r'^under \$',
        ]
        
        address_lower = address.lower()
        for pattern in invalid_patterns:
            if re.search(pattern, address_lower):
                return False
        
        # Must have at least a number
        if not re.search(r'\d+', address):
            return False
        
        # Should have at least 10 characters
        if len(address) < 10:
            return False
        
        return True
    
    async def _fetch_from_aggregate_pages(
        self,
        location: str,
        property_type: str,
        max_price: Optional[int]
    ) -> List[Dict]:
        """
        Fetch aggregate search pages (Zillow, Realtor.com) and extract individual listings
        """
        
        print("📄 Strategy 2: Scraping aggregate pages...")
        
        results = []
        
        # Build URLs for aggregate pages
        urls = self._build_aggregate_urls(location, property_type, max_price)
        
        # Fetch and scrape each page
        for url in urls[:3]:  # Limit to 3 sources
            try:
                listings = await self._scrape_listing_page(url)
                results.extend(listings)
                print(f"   ✅ Scraped {len(listings)} from {url[:50]}...")
            except Exception as e:
                print(f"   ⚠️ Scraping failed for {url[:50]}: {e}")
        
        return results
    
    def _build_aggregate_urls(
        self,
        location: str,
        property_type: str,
        max_price: Optional[int]
    ) -> List[str]:
        """
        Build direct URLs to listing pages on major sites
        """
        
        urls = []
        
        # Format location for URLs
        location_slug = location.lower().replace(' ', '-').replace(',', '')
        
        # Zillow
        zillow_url = f"https://www.zillow.com/{location_slug}/land_type/"
        if max_price:
            zillow_url += f"0-{max_price}_price/"
        urls.append(zillow_url)
        
        # Realtor.com
        realtor_url = f"https://www.realtor.com/realestateandhomes-search/{location_slug}/type-land"
        urls.append(realtor_url)
        
        # LandWatch
        landwatch_url = f"https://www.landwatch.com/{location_slug}/land-for-sale"
        if max_price:
            landwatch_url += f"?price_max={max_price}"
        urls.append(landwatch_url)
        
        return urls
    
    async def _scrape_listing_page(self, url: str) -> List[Dict]:
        """
        Scrape a listing page and extract individual properties
        """
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, 
                    headers=headers, 
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    
                    if response.status != 200:
                        return []
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Identify which site we're scraping
                    if 'zillow.com' in url:
                        return self._parse_zillow_html(soup, url)
                    elif 'realtor.com' in url:
                        return self._parse_realtor_html(soup, url)
                    elif 'landwatch.com' in url:
                        return self._parse_landwatch_html(soup, url)
                    else:
                        return self._parse_generic_html(soup, url)
        
        except Exception as e:
            print(f"   ❌ Scraping error: {e}")
            return []
    
    def _parse_zillow_html(self, soup: BeautifulSoup, url: str) -> List[Dict]:
        """
        Extract property listings from Zillow HTML
        """
        
        results = []
        
        # Zillow uses article tags for listings
        listings = soup.find_all(['article', 'div'], class_=lambda x: x and 'list-card' in x.lower() if x else False)
        
        for listing in listings[:10]:
            try:
                # Address
                address_elem = listing.find(['address', 'span'], class_=lambda x: x and 'address' in x.lower() if x else False)
                address = address_elem.text.strip() if address_elem else None
                
                # Price
                price_elem = listing.find(['span', 'div'], class_=lambda x: x and 'price' in x.lower() if x else False)
                price = self._extract_price(price_elem.text) if price_elem else 0
                
                # Details
                details = listing.text
                acres = self._extract_acres(details)
                beds, baths = self._extract_beds_baths(details)
                sqft = self._extract_sqft(details)
                
                # Link
                link_elem = listing.find('a', href=True)
                property_url = link_elem['href'] if link_elem else None
                if property_url and not property_url.startswith('http'):
                    property_url = f"https://www.zillow.com{property_url}"
                
                if address and self._is_valid_address(address):
                    results.append({
                        'address': address,
                        'price': price,
                        'acres': acres,
                        'lot_size': f"{acres} acres" if acres else None,
                        'bedrooms': beds,
                        'bathrooms': baths,
                        'sqft': sqft,
                        'property_type': self._guess_property_type(details),
                        'source': 'Zillow',
                        'source_url': property_url or url
                    })
            
            except Exception as e:
                continue
        
        return results
    
    def _parse_realtor_html(self, soup: BeautifulSoup, url: str) -> List[Dict]:
        """
        Extract property listings from Realtor.com HTML
        """
        
        results = []
        
        # Realtor.com structure
        listings = soup.find_all(['div', 'li'], class_=lambda x: x and 'property' in x.lower() if x else False)
        
        for listing in listings[:10]:
            try:
                # Address
                address_elem = listing.find(['div', 'span'], {'data-testid': 'property-address'})
                if not address_elem:
                    address_elem = listing.find(['div', 'span'], class_=lambda x: x and 'address' in x.lower() if x else False)
                
                address = address_elem.text.strip() if address_elem else None
                
                # Price
                price_elem = listing.find(['span', 'div'], {'data-testid': 'list-price'})
                if not price_elem:
                    price_elem = listing.find(['span', 'div'], class_=lambda x: x and 'price' in x.lower() if x else False)
                
                price = self._extract_price(price_elem.text) if price_elem else 0
                
                if address and self._is_valid_address(address):
                    results.append({
                        'address': address,
                        'price': price,
                        'property_type': 'Land',
                        'source': 'Realtor.com',
                        'source_url': url
                    })
            
            except Exception as e:
                continue
        
        return results
    
    def _parse_landwatch_html(self, soup: BeautifulSoup, url: str) -> List[Dict]:
        """
        Extract property listings from LandWatch HTML
        """
        
        results = []
        
        # LandWatch uses specific classes
        listings = soup.find_all(['div', 'article'], class_=lambda x: x and ('propcard' in x.lower() or 'listing' in x.lower()) if x else False)
        
        for listing in listings[:10]:
            try:
                # Address
                address_elem = listing.find(['h2', 'h3', 'div'], class_=lambda x: x and ('address' in x.lower() or 'location' in x.lower()) if x else False)
                address = address_elem.text.strip() if address_elem else None
                
                # Price
                price_elem = listing.find(['span', 'div'], class_=lambda x: x and 'price' in x.lower() if x else False)
                price = self._extract_price(price_elem.text) if price_elem else 0
                
                # Acres
                acres_elem = listing.find(text=lambda x: x and 'acre' in x.lower() if x else False)
                acres = self._extract_acres(acres_elem) if acres_elem else None
                
                if address and self._is_valid_address(address):
                    results.append({
                        'address': address,
                        'price': price,
                        'acres': acres,
                        'lot_size': f"{acres} acres" if acres else None,
                        'property_type': 'Land',
                        'source': 'LandWatch',
                        'source_url': url
                    })
            
            except Exception as e:
                continue
        
        return results
    
    def _parse_generic_html(self, soup: BeautifulSoup, url: str) -> List[Dict]:
        """
        Generic parser for unknown listing sites
        """
        
        results = []
        
        # Look for common patterns
        text = soup.get_text()
        
        # Find all potential addresses (number + street name)
        address_pattern = r'\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Way)'
        addresses = re.findall(address_pattern, text)
        
        for address in addresses[:10]:
            if self._is_valid_address(address):
                results.append({
                    'address': address,
                    'price': 0,
                    'property_type': 'Land',
                    'source': 'Real Estate Listing',
                    'source_url': url
                })
        
        return results
    
    # Keep all extraction methods from previous version
    def _extract_price(self, text: str) -> int:
        """Extract price from text"""
        patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})+)',
            r'\$\s*(\d{4,})',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                price_str = match.group(1).replace(',', '')
                try:
                    price = int(price_str)
                    if 1000 <= price <= 50000000:
                        return price
                except ValueError:
                    continue
        return 0
    
    def _extract_acres(self, text: str) -> Optional[float]:
        """Extract acreage"""
        if not text:
            return None
        patterns = [
            r'([\d.]+)\s*acres?',
            r'([\d.]+)\s*ac\b',
        ]
        for pattern in patterns:
            match = re.search(pattern, str(text).lower())
            if match:
                try:
                    acres = float(match.group(1))
                    if 0.1 <= acres <= 10000:
                        return acres
                except ValueError:
                    continue
        return None
    
    def _extract_beds_baths(self, text: str) -> tuple:
        """Extract bedrooms and bathrooms"""
        beds = None
        baths = None
        
        bed_match = re.search(r'(\d+)\s*(?:bed|bd|bedroom)', str(text).lower())
        if bed_match:
            beds = int(bed_match.group(1))
        
        bath_match = re.search(r'([\d.]+)\s*(?:bath|ba)', str(text).lower())
        if bath_match:
            baths = float(bath_match.group(1))
        
        return beds, baths
    
    def _extract_sqft(self, text: str) -> Optional[int]:
        """Extract square footage"""
        patterns = [r'([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)']
        for pattern in patterns:
            match = re.search(pattern, str(text).lower())
            if match:
                sqft_str = match.group(1).replace(',', '')
                try:
                    sqft = int(sqft_str)
                    if 100 <= sqft <= 50000:
                        return sqft
                except ValueError:
                    continue
        return None
    
    def _guess_property_type(self, text: str) -> str:
        """Guess property type"""
        text_lower = str(text).lower()
        if any(word in text_lower for word in ['land', 'lot', 'acre', 'vacant']):
            return 'Land'
        elif any(word in text_lower for word in ['commercial', 'office']):
            return 'Commercial'
        elif any(word in text_lower for word in ['house', 'home', 'bed']):
            return 'Residential'
        return 'Real Estate'
    
    def _identify_source(self, display_link: str, url: str) -> str:
        """Identify source website"""
        domain = display_link.lower()
        if 'zillow' in domain:
            return 'Zillow'
        elif 'realtor.com' in domain:
            return 'Realtor.com'
        elif 'landwatch' in domain:
            return 'LandWatch'
        elif 'redfin' in domain:
            return 'Redfin'
        return 'Real Estate Listing'
    
    def _extract_property_details(self, title: str, snippet: str, url: str, location: str) -> Optional[Dict]:
        """Extract property details from search result"""
        combined_text = f"{title} {snippet}"
        price = self._extract_price(combined_text)
        address = self._extract_address(title, snippet, location)
        acres = self._extract_acres(combined_text)
        beds, baths = self._extract_beds_baths(combined_text)
        sqft = self._extract_sqft(combined_text)
        
        if address or price > 0:
            return {
                'address': address or title[:100],
                'price': price,
                'acres': acres,
                'lot_size': f"{acres} acres" if acres else None,
                'bedrooms': beds,
                'bathrooms': baths,
                'sqft': sqft,
                'property_type': self._guess_property_type(combined_text),
                'description': snippet[:200]
            }
        return None
    
    def _extract_address(self, title: str, snippet: str, location: str) -> Optional[str]:
        """Extract property address"""
        # Look for street address in title first
        street_pattern = r'\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Dr|Ln|Ct|Blvd|Way|Pkwy|Pl|Loop|Cir)'
        
        match = re.search(street_pattern, title)
        if match:
            return match.group(0)
        
        # Try snippet
        match = re.search(street_pattern, snippet)
        if match:
            return match.group(0)
        
        # Use title if it looks like an address
        if re.search(r'\d+', title) and len(title) > 10 and len(title) < 100:
            return title.split('|')[0].strip()
        
        return None
    
    def _deduplicate_results(self, results: List[Dict]) -> List[Dict]:
        """Remove duplicates"""
        seen = set()
        unique = []
        
        for result in results:
            address = result.get('address', '').lower().strip()
            price = result.get('price', 0)
            identifier = f"{address}_{price}" if address else None
            
            if identifier and identifier not in seen:
                seen.add(identifier)
                unique.append(result)
        
        return unique
    
    async def search_market_data(self, location: str) -> Dict:
        """Get market trends"""
        # Same as before
        return {}