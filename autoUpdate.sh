#!/bin/bash
set -e

# Load environment variables from .env file
source .env

updateCode=$(git pull);

if [[ "$updateCode" == "Already up to date." ]]
then
  echo $updateCode
  exit
fi



docker-compose build

if [ "$ENVIRONMENT" != "production" ]; then
  indexVersion=`cat deploy/index-flag`
  { # try

      indexVersionDeployed=`cat data/index-flag`
      #save your output

  } || { # catch
      indexVersionDeployed="0"
  }
  echo "$indexVersion $indexVersionDeployed"

  if [ "$indexVersion" -ne "$indexVersionDeployed" ];
  then 
    echo "Need to reset database"
    rm -r data/*
    echo $indexVersion > data/index-flag
  fi  
fi

docker-compose up -d