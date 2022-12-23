window.scrollTo(0, 0);
window.twttr = (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0], t = window.twttr || {};
    if (d.getElementById(id)) return t;
    js = d.createElement(s);
    js.id = id;
    js.src = 'https://platform.twitter.com/widgets.js';
    fjs.parentNode.insertBefore(js, fjs);

    t._e = [];
    t.ready = function(f) {
      t._e.push(f);
    };

    return t;
}(document, 'script', 'twitter-wjs'));

Date.prototype.addHours = function(hours) {
    this.setTime(this.getTime() + (hours * 60 * 60 * 1000));
    return this;
}

const twoDigits = (num) => num.toLocaleString('en-US', { minimumIntegerDigits: 2 });
const dp = (date) => Date.parse(date);
// return current date when no argument is passed
const dpnd = (date=new Date()) => Date.parse(new Date(date));

const msgContainer = document.querySelector('#msg-container');
const msg = document.querySelector('#msg');
const timerDiv = document.querySelector('#timer');
const tweetEmbed = document.querySelector('#tweet-embed');

// show tweet only when fully rendered
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.children.length === 1 && mutation.target.children[0].tagName === 'DIV') {
            tweetEmbed.classList.remove('hidden');
        }
    });
});
const body = document.querySelector('body');
let disa = true;
observer.observe(tweetEmbed, { childList: true });

function displayMessageAndTweet(status, countdownTarget, embed) {
    let showTweet = true;
    body.classList.remove('disable-scroll');
    msgContainer.classList.remove('load-anim');
    tweetEmbed.classList.add('hidden');

    if (status === 'done' || status === 'just_done') {
        msgContainer.classList.add('abs-center');
        timerDiv.classList.add('hidden');

        if (status === 'just_done') {
            msg.textContent = 'COUNTDOWN\n HAS FINISHED.\n DON\'T PANIC.';
            showTweet = false;
        } else if (dpnd() - dpnd(countdownTarget) < 0) {
            // maint ends early
            msg.textContent = 'Maintenance\n ended early';
        } else if ((dpnd() - dpnd(countdownTarget)) / 1000 < 43200) {
            // during the first 12 hours after server reset
            msg.textContent = 'Maintenance\n has ended';
        } else {
            msg.textContent = 'No maintenance\n ongoing or scheduled';
            showTweet = false;
        }
    } else {
        msgContainer.classList.remove('abs-center');
        timerDiv.classList.remove('hidden');

        if (status === 'maint') {
            msg.textContent = 'MAINTENANCE\n WILL END IN';
            showTweet = false;
        } else if (status === 'mt_countdown') {
            msg.textContent = 'MAINTENANCE\n WILL START IN';
        } else if (status === 'extension') {
            msg.textContent = 'MAINTENANCE\n WAS EXTENDED.\n IT WILL END IN';
        }
    }
    
    if (status !== prevStatus && showTweet) {
        // embed new tweet
        tweetEmbed.innerHTML = embed;
        twttr.widgets.load(tweetEmbed);
    } else if (status !== prevStatus && !showTweet) {
        body.classList.add('disable-scroll');
    } else if (showTweet) {
        // continue showing current tweet
        tweetEmbed.classList.remove('hidden');
    }
}

const second = 1000;
const minute = second * 60;
const hour = minute * 60;
const day = hour * 24;
let timer, prevStatus;
// assign impossible number so it's guaranteed to be true on the first comparison
let prevDay = 367, prevHour = 24, prevMin = 61;

function countdownTimer(status, monthDay, maintDur, embed) {
    const currentDateTime = new Date();
    const currentMonth = currentDateTime.getMonth() + 1;
    const maintMonth = monthDay.split('/')[0];
    let year = currentDateTime.getFullYear();
    // check if maint is next year
    if (dp(`${maintMonth}/01/70`) < dp(`${currentMonth}/01/70`)) year += 1;
    // set countdown date
    let countdownTarget = new Date(`${monthDay}/${year} 12:00 AM UTC-7:00`);
    // override status on during 1 hour before maint
    if (status === 'maint' && dp(countdownTarget) > dp(currentDateTime)) status = 'mt_countdown';
    // add maint duration
    if (status === 'maint' || status === 'extension') countdownTarget = countdownTarget.addHours(maintDur);

    function showRemaining() {
        const distance = countdownTarget - new Date();
        if (distance < 0) {
            if (status == 'mt_countdown') {
                // transition from maint countdown to end-of-maint countdown
                countdownTimer('maint', monthDay, maintDur, null);
            } else if (status === 'maint' || status === 'extension') {
                // display message until tweet about maintenance has ended
                displayMessageAndTweet('just_done', null, embed);
                clearInterval(timer);
            } else {
                clearInterval(timer);
            }
            return;
        }
        const days = Math.floor(distance / day);
        const hours = twoDigits(Math.floor(distance % day / hour));
        const minutes = twoDigits(Math.floor(distance % hour / minute));
        const seconds = twoDigits(Math.floor(distance % minute / second));

        if (days !== prevDay) document.querySelector('#day').textContent = days;
        if (hours !== prevHour) document.querySelector('#hour').textContent = hours;
        if (minutes !== prevMin) document.querySelector('#minute').textContent = minutes;
        document.querySelector('#second').textContent = seconds;

        prevDay = days;
        prevHour = hours;
        prevMin = minutes;

        if (prevStatus !== status) displayMessageAndTweet(status, countdownTarget, embed);
    }

    // clear previous timer every time the function is called
    clearInterval(timer);

    if (status === 'done') {
        displayMessageAndTweet(status, countdownTarget, embed);
    } else {
        showRemaining();
        timer = setInterval(showRemaining, 1000);
    }

    prevStatus = status;
}

function update() {
    console.log(`${new Date().toLocaleTimeString()} - update`);
    const source = new EventSource('/update');

    source.addEventListener('message', (e) => {
        console.log(`${new Date().toLocaleTimeString()} - data recieved`);
        // replace single quotes with double quotes
        // replace double quotes inside html tags with single quotes
        // a quotation mark and a closing bracket is somehow missing so I added it back
        const parsed_data = JSON.parse(e.data.replace(/'/g,'"').replace(/(?<=<.*)"(?=.*>)/g, "'") + '"}');

        // render countdown timer or not depending aon status
        countdownTimer(parsed_data['status'], parsed_data['date'], parseInt(parsed_data['maint_dur']), parsed_data['embed']);
        source.close();
    });

    source.addEventListener('error', () => {
        window.location.reload();
    });
}

update();
// avoid triggering focus event on load
let prevTime = Number.MAX_SAFE_INTEGER;
// update every minute when tab is active
setInterval(() => {
    if (!document.hidden) {
        update();
        prevTime = dpnd();
    }
}, 60000);
// update when tab is on focus and a minute since last call
document.addEventListener('focus', () => {
    if (dpnd() - prevTime > 60000) update();
    prevTime = dpnd();
});