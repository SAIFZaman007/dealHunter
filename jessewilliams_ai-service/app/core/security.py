from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from jose import jwt, JWTError

security = HTTPBearer()

def verify_internal_api_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verify internal API key from Node.js backend"""
    internal_secret = os.getenv("INTERNAL_API_SECRET")
    
    if credentials.credentials != internal_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )
    return True

def verify_jwt_token(token: str) -> dict:
    """Verify JWT token from Node.js"""
    try:
        payload = jwt.decode(
            token,
            os.getenv("JWT_SECRET"),
            algorithms=["HS256"]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )