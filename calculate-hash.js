import crypto from "node:crypto";

const key = "ADMIN-INTERNAL-KEY";
const hash = crypto.createHash("sha256").update(key.trim().toUpperCase()).digest("hex");

console.log("Key:", key);
console.log("Hash:", hash);
