import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
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
