# auth_routes.py
import os
import requests
from flask import Blueprint, redirect, request, session, jsonify
from urllib.parse import urlencode
from config import Config

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/auth/google")
def google_auth():
    """Redirect user to Google’s OAuth 2.0 consent screen."""
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": Config.GOOGLE_CLIENT_ID,
        "redirect_uri": Config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(Config.GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    url = f"{base_url}?{urlencode(params)}"
    return redirect(url)

@auth_bp.route("/auth/google/callback")
def google_callback():
    """Google redirects here after user consents. Exchange code for tokens, fetch user info, store in session."""
    code = request.args.get("code")
    if not code:
        return "Missing code in query", 400

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": Config.GOOGLE_CLIENT_ID,
        "client_secret": Config.GOOGLE_CLIENT_SECRET,
        "redirect_uri": Config.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    # 1) Exchange authorization code for tokens
    token_res = requests.post(token_url, data=data)
    if token_res.status_code != 200:
        return f"Failed to get token: {token_res.text}", 500
    token_json = token_res.json()

    # 2) Fetch user info
    userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization": f"Bearer {token_json['access_token']}"}
    userinfo_res = requests.get(userinfo_url, headers=headers)
    if userinfo_res.status_code != 200:
        return f"Failed to get user info: {userinfo_res.text}", 500
    userinfo_json = userinfo_res.json()

    # 3) Store user in session
    session["googleUser"] = {
        "id": userinfo_json["id"],
        "email": userinfo_json["email"],
        "name": userinfo_json["name"],
        "picture": userinfo_json["picture"],
        "accessToken": token_json["access_token"],
    }

    # 4) Redirect back to front-end
    # e.g. "http://localhost:3000" if your React dev server is on 3000
    return redirect("http://localhost:3000")

@auth_bp.route("/api/status")
def api_status():
    """Check if user is logged in."""
    user = session.get("googleUser")
    return jsonify({
        "success": True,
        "authenticated": bool(user),
        "user": user or None,
    })

@auth_bp.route("/api/logout")
def api_logout():
    """Logs out the user by clearing the session."""
    session.clear()
    return jsonify({"success": True})
