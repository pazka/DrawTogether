# DrawTogether

URL-dynamic Online Live Whiteboard with layers and text edits. The changes you make are immediatly persisted and seen by other, also they can see your cursor so it add some usage fun. 

Image scalabitlity and movement are handled by the browser, tested on Chrome

Unused rooms are automatically removed after something like 2 weeks

Enter a custom URL to create a new whiteboard !

# Demo 

[Go test it in production !](https://draw.hosh.it/Demo)

# Tech

Made with Node, Node-persist, Express, Socket.IO & ReactJs

# Why ?

Made originally to edit custom maps and play custom RPG with friends

# How to run

## Docker

```bash
docker run -p 9001:9001 -d --name drawtogether pazka/drawtogether:latest -v ./uploads:/app/front/build/uploads
```

```.yml
version: '3'

services:
  drawtogether:
    container_name: drawtogether
    image: pazka/drawtogether:latest
    ports:
      - "9001:80"
    volumes:
      - ./uploads:/app/front/build/uploads
      - ./persist:/app/.node-persist
```