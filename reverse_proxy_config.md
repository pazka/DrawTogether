
In `/etc/nginx/sites-available/reverse-proxy.conf` :
```
server {
    server_name        draw.hosh.it;
    location / {
        proxy_pass       http://127.0.0.1:9001;
        proxy_set_header     host hoshit.com;
        proxy_set_header     Upgrade $http_upgrade;
        proxy_set_header     Connection "upgrade";
        proxy_read_timeout     86400;
    }
}
```

Make sure the nginx.conf have a good request size limit : 
```
http {
    ...
    client_max_body_size 100M;
}
```