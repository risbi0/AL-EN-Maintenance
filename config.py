import os

class Config(object):
    BEARER_TOKEN = os.environ.get('BEARER_TOKEN')