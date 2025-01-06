# video_routes.py
import os
import requests
import shutil
import uuid
import subprocess
from flask import Blueprint, request, jsonify, session, abort
from config import Config
from functools import wraps

video_bp = Blueprint("video_bp", __name__)

def require_auth(f):
    """Decorator to ensure user is logged in (similar to 'requireAuth' in Node)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "googleUser" not in session:
            return jsonify({"success": False, "error": "Not logged in"}), 401
        return f(*args, **kwargs)
    return decorated_function

def convert_webm_to_mp4(input_path, output_path):
    """Convert .webm to .mp4 using ffmpeg via subprocess."""
    cmd = [
        "ffmpeg", "-y",  # overwrite output
        "-i", input_path,
        "-c:v", "libx264",
        "-c:a", "aac",
        output_path
    ]
    subprocess.run(cmd, check=True)

def handle_video_transcription(mp4_file_path):
    """
    Calls Google Generative AI (Gemini) to transcribe an MP4.
    Replace with actual HTTP requests if no official library is available.
    """
    try:
        with open(mp4_file_path, "rb") as f:
            video_bytes = f.read()
        base64_video = video_bytes.encode("base64")  # or use base64.standard_b64encode in Python 3

        # Example: send prompt + inline data to the model
        prompt = "Please transcribe this video content accurately."
        # This below is a pseudo-code request. Adjust to your actual API for Gemini:
        # (In practice, you'd do a requests.post(...) with your model endpoint.)
        gemini_endpoint = "https://generativeai.googleapis.com/v1/models/{}".format(Config.GEMINI_MODEL)
        headers = {"Authorization": f"Bearer {Config.GEMINI_API_KEY}"}
        json_data = {
            "prompt": prompt,
            "video_base64": base64_video,
        }
        # This call is illustrative only—Gemini’s real API is not exactly like this:
        res = requests.post(gemini_endpoint, headers=headers, json=json_data)
        if res.status_code != 200:
            raise Exception(f"Gemini transcription error: {res.text}")

        # Suppose the transcription text is in res.json()["transcript"]
        return res.json().get("transcript", "")
    except Exception as e:
        print("Error in handle_video_transcription:", e)
        raise e

@video_bp.route("/api/video/create-room", methods=["POST"])
@require_auth
def create_room():
    """Creates a new Whereby meeting."""
    try:
        url = f"{Config.WHEREBY_BASE_URL}/meetings"
        payload = {
            "isLocked": False,
            "roomNamePrefix": "myapp",
            "roomMode": "group",
            "endDate": "2099-12-31T12:00:00.000Z",
            "fields": ["hostRoomUrl", "roomUrl", "meetingId"],
            "features": {
                "recording": True,
                "streaming": True,
                "chat": True,
                "polls": True,
                "screenShare": True,
                "participants": True
            }
        }
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}",
            "Content-Type": "application/json",
        }
        resp = requests.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            print("Error creating Whereby room:", resp.text)
            return jsonify({"success": False, "error": "Failed to create room"}), 500

        data = resp.json()
        return jsonify({
            "success": True,
            "room": {
                "hostUrl": data["hostRoomUrl"],
                "viewerUrl": data["roomUrl"],
                "meetingId": data["meetingId"],
            }
        })
    except Exception as e:
        print("Exception creating Whereby room:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@video_bp.route("/api/video/recordings", methods=["GET"])
@require_auth
def get_recordings():
    """Fetch all Whereby recordings."""
    try:
        url = f"{Config.WHEREBY_BASE_URL}/recordings"
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}"
        }
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return jsonify({"success": False, "error": resp.text}), 500

        return jsonify({
            "success": True,
            "recordings": resp.json().get("results", [])
        })
    except Exception as e:
        print("Error fetching recordings:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@video_bp.route("/api/video/recordings/<meeting_id>", methods=["GET"])
@require_auth
def get_recordings_by_meeting(meeting_id):
    """Fetch all recordings for a specific meetingId."""
    try:
        # 1) fetch all recordings
        url = f"{Config.WHEREBY_BASE_URL}/recordings"
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}"
        }
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return jsonify({"success": False, "error": resp.text}), 500

        all_recordings = resp.json().get("results", [])
        # 2) filter
        filtered = [r for r in all_recordings if r.get("meetingId") == meeting_id]
        if not filtered:
            return jsonify({"success": False, "error": "No recordings found for this meeting"}), 404

        return jsonify({"success": True, "recordings": filtered})
    except Exception as e:
        print("Error fetching recordings by meetingId:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@video_bp.route("/api/recordings/<recording_id>", methods=["GET"])
@require_auth
def get_recording_metadata(recording_id):
    """Fetch metadata for a single recording."""
    try:
        url = f"{Config.WHEREBY_BASE_URL}/recordings/{recording_id}"
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}"
        }
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return jsonify({"success": False, "error": resp.text}), 500

        return jsonify({"success": True, "data": resp.json()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@video_bp.route("/api/recordings/<recording_id>/access-link", methods=["GET"])
@require_auth
def get_recording_access_link(recording_id):
    """Return a short-lived link to view/download the recording."""
    try:
        url = f"{Config.WHEREBY_BASE_URL}/recordings/{recording_id}/access-link"
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}"
        }
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return jsonify({"success": False, "error": resp.text}), 500

        return jsonify({"success": True, "data": resp.json()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@video_bp.route("/api/recordings/bulk-delete", methods=["POST"])
@require_auth
def bulk_delete_recordings():
    """Schedules multiple recordings for deletion in Whereby."""
    try:
        body = request.json
        recording_ids = body.get("recordingIds", [])
        if not isinstance(recording_ids, list):
            return jsonify({"success": False, "error": "recordingIds must be an array"}), 400

        url = f"{Config.WHEREBY_BASE_URL}/recordings/bulk-delete"
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}",
            "Content-Type": "application/json"
        }
        resp = requests.post(url, json={"recordingIds": recording_ids}, headers=headers)
        if resp.status_code != 200:
            return jsonify({"success": False, "error": resp.text}), 500

        return jsonify({"success": True, "message": "Recordings scheduled for deletion"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@video_bp.route("/api/recordings/<recording_id>", methods=["DELETE"])
@require_auth
def delete_recording(recording_id):
    """Schedules a single recording for deletion in Whereby."""
    try:
        url = f"{Config.WHEREBY_BASE_URL}/recordings/{recording_id}"
        headers = {
            "Authorization": f"Bearer {Config.WHEREBY_API_KEY}"
        }
        resp = requests.delete(url, headers=headers)
        if resp.status_code != 200:
            return jsonify({"success": False, "error": resp.text}), 500

        return jsonify({"success": True, "message": "Recording scheduled for deletion"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@video_bp.route("/api/recordings/<recording_id>/transcribe", methods=["GET"])
@require_auth
def transcribe_recording(recording_id):
    """
    1) Fetch the access link
    2) Download the file locally
    3) Convert .webm -> .mp4 if needed
    4) Transcribe via Gemini
    5) Return transcription
    """
    try:
        # 1) Get the access link
        url = f"{Config.WHEREBY_BASE_URL}/recordings/{recording_id}/access-link"
        headers = {"Authorization": f"Bearer {Config.WHEREBY_API_KEY}"}
        link_res = requests.get(url, headers=headers)
        if link_res.status_code != 200:
            return jsonify({"success": False, "error": link_res.text}), 500

        access_link = link_res.json().get("accessLink")
        if not access_link:
            return jsonify({"success": False, "error": "No accessLink returned"}), 400

        # 2) Download the file
        uploads_dir = Config.UPLOAD_DIR
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)

        temp_file_name = f"temp-{uuid.uuid4()}"
        temp_file_path = os.path.join(uploads_dir, temp_file_name)

        file_res = requests.get(access_link, stream=True)
        if file_res.status_code != 200:
            return jsonify({"success": False, "error": f"Download failed: {file_res.text}"}), 500

        with open(temp_file_path, "wb") as f:
            shutil.copyfileobj(file_res.raw, f)

        # 3) Convert to .mp4 if needed
        _, ext = os.path.splitext(access_link)
        ext_lower = ext.lower()
        final_path = temp_file_path
        mp4_path = temp_file_path + ".mp4"

        if ext_lower == ".webm":
            convert_webm_to_mp4(temp_file_path, mp4_path)
            os.remove(temp_file_path)
            final_path = mp4_path
        elif ext_lower == ".mp4":
            # rename the temp file to .mp4
            os.rename(temp_file_path, mp4_path)
            final_path = mp4_path
        else:
            # fallback: rename to .mp4 anyway
            os.rename(temp_file_path, mp4_path)
            final_path = mp4_path

        # 4) Transcribe
        transcription = handle_video_transcription(final_path)

        # Optionally cleanup
        # os.remove(final_path)  # If you want to remove the local file after

        return jsonify({
            "success": True,
            "transcription": transcription
        })

    except Exception as e:
        print("Transcription error:", e)
        return jsonify({"success": False, "error": str(e)}), 500
