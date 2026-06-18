#!/bin/bash
# Create S3 bucket for Valtimo uploads
awslocal s3 mb s3://valtimo-uploads

# Configure CORS for browser uploads
awslocal s3api put-bucket-cors --bucket valtimo-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'
