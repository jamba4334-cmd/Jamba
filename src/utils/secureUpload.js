import { getAuth } from "firebase/auth";
import { API_BASE_URL } from "../apiConfig";

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;

/**
 * Signed Cloudinary upload. The server decides the folder and checks the caller's role.
 * purpose: "kyc" | "review" | "product" | "storefront" | "profile" | "site"
 * Returns { url, isVideo }.
 */
export async function secureUpload(file, purpose, { onProgress } = {}) {
    if (!file) throw new Error("No file selected.");
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isVideo && !isImage && !isPdf) throw new Error("Only images, videos or PDF files are allowed.");
    const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > limitMb * 1024 * 1024) throw new Error(`File is too large (max ${limitMb} MB).`);

    const user = getAuth().currentUser;
    if (!user) throw new Error("Your session expired. Please sign in again.");
    const token = await user.getIdToken();

    const sigRes = await fetch(
        `${API_BASE_URL}/api/v1/secure/upload-signature?purpose=${encodeURIComponent(purpose)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (sigRes.status === 401) throw new Error("Your session expired. Please sign in again.");
    if (sigRes.status === 403) throw new Error("You are not allowed to upload here.");
    if (!sigRes.ok) throw new Error("Could not prepare the upload. Please try again.");
    const { signature, timestamp, folder, api_key, cloud_name } = await sigRes.json();

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", api_key);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("signature", signature);

    const resourceType = isVideo ? "video" : isPdf ? "raw" : "image";
    const url = `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`;

    const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onload = () => {
            let body = {};
            try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
            if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) resolve(body);
            else reject(new Error(body.error?.message || "Upload failed."));
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(form);
    });

    return { url: data.secure_url, isVideo: data.resource_type === "video" };
}
