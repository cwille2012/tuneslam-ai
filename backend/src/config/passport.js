import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as SpotifyStrategy } from 'passport-spotify';
import User from '../models/User.js';

// Initialize passport strategies - called AFTER env vars are loaded
export const initializePassport = () => {
  // Validate Facebook credentials
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    console.error('⚠️  Facebook OAuth credentials missing!');
    console.error('   FACEBOOK_APP_ID:', process.env.FACEBOOK_APP_ID ? '✓ Set' : '✗ Missing');
    console.error('   FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET ? '✓ Set' : '✗ Missing');
    console.error('   FACEBOOK_CALLBACK_URL:', process.env.FACEBOOK_CALLBACK_URL ? '✓ Set' : '✗ Missing');
    console.error('');
    console.error('   Please add these to your backend/.env file');
    return; // Don't register strategy if credentials missing
  }

  // Facebook Strategy
  passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'displayName', 'name', 'emails', 'photos']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Debug: Log what Facebook provides
        console.log('📘 Facebook Profile Data:', JSON.stringify({
          id: profile.id,
          displayName: profile.displayName,
          name: profile.name,
          emails: profile.emails,
          photos: profile.photos
        }, null, 2));
        
        // Check if user already exists with this Facebook ID
        let user = await User.findOne({ facebookId: profile.id });
        
        if (user) {
          // Update existing user with name fields if they don't have them
          let updated = false;
          if (!user.firstName && profile.name?.givenName) {
            user.firstName = profile.name.givenName;
            updated = true;
          }
          if (!user.lastName && profile.name?.familyName) {
            user.lastName = profile.name.familyName;
            updated = true;
          }
          if (updated) {
            await user.save();
            console.log('✅ Updated existing user with firstName/lastName');
          }
          return done(null, user);
        }
        
        // Check if user exists with this email (account linking)
        if (profile.emails && profile.emails[0]) {
          user = await User.findOne({ email: profile.emails[0].value });
          
          if (user) {
            // Link Facebook account to existing user and update name fields
            user.facebookId = profile.id;
            user.firstName = user.firstName || profile.name?.givenName || profile.displayName.split(' ')[0] || '';
            user.lastName = user.lastName || profile.name?.familyName || profile.displayName.split(' ').slice(1).join(' ') || '';
            user.profilePicture = user.profilePicture || profile.photos[0]?.value;
            await user.save();
            return done(null, user);
          }
        }
        
        // Create new user
        const newUser = new User({
          username: profile.username || profile.displayName.replace(/\s+/g, '_').toLowerCase() + '_' + Math.random().toString(36).substr(2, 5),
          firstName: profile.name?.givenName || profile.displayName.split(' ')[0] || '',
          lastName: profile.name?.familyName || profile.displayName.split(' ').slice(1).join(' ') || '',
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : `fb_${profile.id}@facebook.tuneslam.local`,
          authProvider: 'facebook',
          facebookId: profile.id,
          profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          isAdmin: false
        });
        
        await newUser.save();
        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }
  ));

  console.log('✅ Passport Facebook strategy initialized');

  // Validate Spotify credentials
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('⚠️  Spotify OAuth credentials missing!');
    console.error('   SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? '✓ Set' : '✗ Missing');
    console.error('   SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
    console.error('   SPOTIFY_REDIRECT_USER_URI:', process.env.SPOTIFY_REDIRECT_USER_URI ? '✓ Set' : '✗ Missing');
    console.error('');
    console.error('   Please add these to your backend/.env file');
    return; // Don't register strategy if credentials missing
  }

  // Spotify Strategy (for user login + library access)
  passport.use('spotify-user', new SpotifyStrategy({
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_REDIRECT_USER_URI,
      scope: ['user-read-email', 'playlist-read-private', 'playlist-read-collaborative', 'user-library-read']
    },
    async (accessToken, refreshToken, expires_in, profile, done) => {
      try {
        console.log('🎵 Spotify User Profile Data:', JSON.stringify({
          id: profile.id,
          displayName: profile.displayName,
          emails: profile.emails,
          photos: profile.photos
        }, null, 2));

        // Check if user already exists with this Spotify ID
        let user = await User.findOne({ spotifyId: profile.id });

        if (user) {
          // Update Spotify tokens (keep library linked and refreshed)
          user.spotifyAccessToken = accessToken;
          user.spotifyRefreshToken = refreshToken;
          user.spotifyUserId = profile.id;
          user.spotifyLinkedAt = new Date();
          user.spotifyTokenExpires = new Date(Date.now() + expires_in * 1000);
          await user.save();
          console.log('✅ Updated existing Spotify user with new tokens');
          return done(null, user);
        }

        // Check if NON-ADMIN user exists with this email (account linking)
        if (profile.emails && profile.emails[0]) {
          // Check for admin account with this email
          const adminUser = await User.findOne({ 
            email: profile.emails[0].value,
            isAdmin: true 
          });

          if (adminUser) {
            // Don't allow linking Spotify to admin accounts
            return done(new Error('This email is associated with an admin account. Please use a different email or create a regular user account.'), null);
          }

          // Check for regular user account
          user = await User.findOne({ 
            email: profile.emails[0].value,
            isAdmin: false
          });

          if (user) {
            // Link Spotify account to existing user
            user.spotifyId = profile.id;
            user.spotifyAccessToken = accessToken;
            user.spotifyRefreshToken = refreshToken;
            user.spotifyUserId = profile.id;
            user.spotifyLinkedAt = new Date();
            user.spotifyTokenExpires = new Date(Date.now() + expires_in * 1000);
            user.profilePicture = user.profilePicture || (profile.photos && profile.photos[0] ? profile.photos[0] : null);
            await user.save();
            console.log('✅ Linked Spotify to existing user account');
            return done(null, user);
          }
        }

        // Create new user with Spotify login + auto-link library
        const newUser = new User({
          username: profile.id + '_' + Math.random().toString(36).substr(2, 5),
          firstName: profile.displayName ? profile.displayName.split(' ')[0] : '',
          lastName: profile.displayName ? profile.displayName.split(' ').slice(1).join(' ') : '',
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : `spotify_${profile.id}@spotify.tuneslam.local`,
          authProvider: 'spotify',
          spotifyId: profile.id,
          // Auto-link library on signup
          spotifyAccessToken: accessToken,
          spotifyRefreshToken: refreshToken,
          spotifyUserId: profile.id,
          spotifyLinkedAt: new Date(),
          spotifyTokenExpires: new Date(Date.now() + expires_in * 1000),
          profilePicture: profile.photos && profile.photos[0] ? profile.photos[0] : null,
          isAdmin: false
        });

        await newUser.save();
        console.log('✅ Created new user with Spotify login + auto-linked library');
        done(null, newUser);
      } catch (error) {
        console.error('❌ Spotify OAuth error:', error);
        done(error, null);
      }
    }
  ));

  console.log('✅ Passport Spotify strategy initialized');
};

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
