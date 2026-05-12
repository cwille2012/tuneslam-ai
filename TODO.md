Update API to https://www.soundtrack.io/our-api/ for public use

Allow upvoting/downvoting to current playing songs? To influence auto-filled tracks later. Also for karma

Should admin songs added to the queue skip voting?
Disable down voting?

If many auto-filled songs are down-voted in a row change up the algorithm?

Spotify rolling rate limit

Rolling passcode on player

Location based access

Developer dashboard (developer.tuneslam.com)

Crossfade:
This is potentially the most complicated part of the whole system. The queue will be played by the Spotify Web Playback API. When the player is open (and the admin has hit play) the number one song in the queue should be played (when this song moves to the now playing section it shopuld be removed from the queue and the number two song advances to the number one spot). As the number one song finishes, a second Spotify Web Playback API should be added (in the background). The second player loads the second song in the queue (now number one) and that song should be "locked" in the queue so that even if a song below it is up-voted it no longer takes the place of the next up song. These two players should overlap for the duration of the "crossfade" setting in the admin settings. As the two songs play at once the volumes should be crossfaded, decreasing the volume of the main song while increasing the volume of the upcoming song. If this will not work reliably or there is a better option, please advise.

karma leaderboards