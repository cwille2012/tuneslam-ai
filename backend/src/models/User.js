import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: function() { 
      // Email required for local auth and admin
      return this.authProvider === 'local' || this.isAdmin;
    },
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: function() {
      // Phone required only for local auth
      return this.authProvider === 'local';
    },
    unique: true,
    sparse: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: function() {
      // Password required only for local auth
      return this.authProvider === 'local';
    }
  },
  // OAuth Fields
  authProvider: {
    type: String,
    enum: ['local', 'facebook'],
    default: 'local'
  },
  facebookId: {
    type: String,
    unique: true,
    sparse: true
  },
  profilePicture: {
    type: String
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  // Admin-specific fields
  businessName: {
    type: String,
    required: function() { return this.isAdmin; }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  // User stats and tracking
  karma: {
    type: Number,
    default: 0
  },
  songsAdded: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  songsUpvoted: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  songsDownvoted: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  stats: {
    songsAddedCount: {
      type: Number,
      default: 0
    },
    songsPlayedCount: {
      type: Number,
      default: 0
    },
    upvotesReceived: {
      type: Number,
      default: 0
    },
    downvotesReceived: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for faster lookups
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ phoneNumber: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to get public profile (without sensitive data)
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    isAdmin: this.isAdmin,
    karma: this.karma,
    stats: this.stats,
    createdAt: this.createdAt
  };
};

// Method to get admin profile
userSchema.methods.toAdminJSON = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    phoneNumber: this.phoneNumber,
    isAdmin: this.isAdmin,
    businessName: this.businessName,
    address: this.address,
    karma: this.karma,
    stats: this.stats,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const User = mongoose.model('User', userSchema);

export default User;
