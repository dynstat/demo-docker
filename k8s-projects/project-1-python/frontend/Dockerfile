# ---- Static Frontend served by Nginx ----
FROM nginx:1.27-alpine

# Remove default site
RUN rm -rf /usr/share/nginx/html/*

# Copy our static files
COPY index.html style.css app.js /usr/share/nginx/html/

# Custom Nginx config (reverse-proxy to backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
