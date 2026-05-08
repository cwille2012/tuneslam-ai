TODO:
Authentication required for viewer
Authentication for queue endpoints
Authentication for databases
Is the votes db in mongo scalable?
Make services and connect to tuneslam.com
Should down votes be a thing?
User logs in with spotify and automatically connects spotify?
Add display name? Or use firstname last initial?
Genre/artist search needs more seed tracks?
Admin dashboard should show currently playing
Change from passwords to text code verification
Link spotify to admin account not session
Only open player if there is a song in the queue?
500 code when opening My Library from admin add song
Crossfade workaround for player
If song is more than half over and player closes, start next song on player open

BUGS:
Recommended songs added have 0 popularity
My library on user spotify only shows 50 songs even more can be loaded
Scroll in Spotify browse for user and admin
User linking spotift callback works but gets stuck

FINISHED NEEDS TESTING:
User should be able to search by artist as well
Test song filling on empty playlist in all modes
Spotify linking account login with spotify
Order of songs is still not perfect (fix added but needs a lot of testing)
Admin can add blacklisted/too long song to queue
Check karma stats are properly being added to database
Minimum popularity setting
Dont need to reorder spotify playlist every time, only next song needs to be correct
Test what happens when song is added to an empty queue and an external song is playing