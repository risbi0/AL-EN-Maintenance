from flask import Flask
from config import Config
import tweepy as tw

app = Flask(__name__)
app.config.from_object(Config)
TWITTER_API_CLIENT = tw.Client(bearer_token=app.config['BEARER_TOKEN'])

from app import routes