from app import TWITTER_API_CLIENT
import re, requests, json

AZUR_LANE_EN_TWITTER = '993682160744738816'
MONTH_DAY = re.compile('\d{1,2}/\d{1,2}')
MAINT_DUR = re.compile('\d(?= hour)')
stop = False
maint_dur = ext_hours = 0
embed = status = ''

def get_embed(id):
    # request to oEmbed API
    request = requests.get(f'https://publish.twitter.com/oembed?url=https://twitter.com/AzurLane_EN/status/{id}&omit_script=true&theme=dark&align=center')
    # bytes to string to dict
    req_dict = json.loads(request.content.decode('utf-8'))
    return req_dict['html']

def check_tweet(tweets):
    # return status, maint duration, date (M/D), html embed
    global stop, status, maint_dur, ext_hours, embed
    
    for tweet in tweets.data:
        # maint finished, no countdown
        if 'Maintenance has ended' in tweet.text:
            status = 'done'
            embed = get_embed(tweet.id)
        # maint extended, server open countdown
        elif 'extend the maintenance' in tweet.text:
            if status != 'done':
                status = 'extension'
                embed = get_embed(tweet.id)
            ext_hours = MAINT_DUR.findall(str(tweet))[0]
        # maint ongoing, server open countdown
        # override in client since this tweet is posted 1 hour before the actual maint
        elif 'servers will be down' in tweet.text:
            if status != 'done' and status != 'extension':
                status = 'maint'
                embed = get_embed(tweet.id)
            maint_dur = int(MAINT_DUR.findall(str(tweet))[0]) + int(ext_hours)
        # maint countdown
        elif 'start maintenance' in tweet.text:
            if status != 'done' and status != 'maint' and status != 'extension':
                status = 'mt_countdown'
                embed = get_embed(tweet.id)
            stop = True
            return status, maint_dur, MONTH_DAY.findall(str(tweet))[0], embed

    return None, None, None, None

def iter_tweets():
    global stop

    tweets = TWITTER_API_CLIENT.get_users_tweets(
        id=AZUR_LANE_EN_TWITTER,
        max_results=5
    )
    status, maint_dur, date, embed = check_tweet(tweets)

    while tweets.meta['next_token'] is not None and not stop:
        tweets = TWITTER_API_CLIENT.get_users_tweets(
            id=AZUR_LANE_EN_TWITTER,
            max_results=5,
            pagination_token=tweets.meta['next_token']
        )
        status, maint_dur, date, embed = check_tweet(tweets)
    
    yield f"""data:{{'status': '{status}',\
                     'maint_dur': '{maint_dur}',\
                     'date': '{date}',\
                     'embed': '{embed}'}}\n\n"""
    # ensure boolean is set back to False every after request
    stop = False
