#!/bin/bash
# Run this once after: npx wrangler login
# Sets CORS on the steward-uploads bucket to allow PUT from your frontend origin.

BUCKET="steward-uploads"

npx wrangler r2 bucket cors put "$BUCKET" --rules '[
  {
    "allowedOrigins": ["http://localhost:3001", "https://*.pages.dev", "https://yourdomain.com"],
    "allowedMethods": ["GET", "PUT", "HEAD"],
    "allowedHeaders": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]'

echo "CORS configured on R2 bucket: $BUCKET"
