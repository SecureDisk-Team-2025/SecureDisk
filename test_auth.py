
import requests
import json
import time
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

BASE_URL = "http://localhost:5000/api"

def generate_python_key_pair():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )
    public_key = private_key.public_key()
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    return public_pem, private_pem

def test_registration(username, public_key):
    url = f"{BASE_URL}/auth/register"
    data = {
        "username": username,
        "email": username + "@example.com",
        "password": "Password123!",
        "public_key": public_key,
        "encrypted_master_key": {"encrypted": "abc", "nonce": "def", "salt": "ghi"}
    }
    try:
        response = requests.post(url, json=data)
        print(f"Registration status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 201
    except Exception as e:
        print(f"Error in registration: {e}")
        return False

def test_login(username, public_key):
    url = f"{BASE_URL}/auth/login"
    data = {
        "type": "password",
        "username": username,
        "password": "Password123!",
        "public_key": public_key
    }
    try:
        response = requests.post(url, json=data)
        print(f"Login status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error in login: {e}")
        return False

if __name__ == "__main__":
    username = "testuser_" + str(int(time.time()))
    pub, priv = generate_python_key_pair()
    if test_registration(username, pub):
        test_login(username, pub)
