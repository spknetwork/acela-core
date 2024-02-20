# Acela Backend Core

Backend core for decentralized video applications on HIVE. 

## Setup

### Have docker installed

Install docker using the reccommended steps for your system, then install docker compose.

On ubuntu, `sudo ./installDockerCompose.sh`

`docker network create web`

### Create web network

`docker network create web`

### Environment variables

Rename `.example.env` to `.env` then fill it out with relevant information

On a server:
`mv .env.example .env`
`nano .env`

### Start containers in dev environment
`sudo docker compose -f docker-compose.local.yml up --build`

### Deploy to staging
`sudo docker compose -f docker-compose.staging.yml up --build -d`
