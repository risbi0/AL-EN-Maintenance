from flask import render_template, Response
from app import app
from app.api_client import iter_tweets

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/update')
def get_date():
    return Response(iter_tweets(), mimetype='text/event-stream')