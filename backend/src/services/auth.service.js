import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const generateToken = (userId, isAdmin) => {
  return jwt.sign(
    { userId, isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const registerUser = async (userData) => {
  const { username, email, phoneNumber, password } = userData;
  
  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }, { phoneNumber }]
  });
  
  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error('Email already registered');
    }
    if (existingUser.username === username) {
      throw new Error('Username already taken');
    }
    if (existingUser.phoneNumber === phoneNumber) {
      throw new Error('Phone number already registered');
    }
  }
  
  // Create new user
  const user = new User({
    username,
    email,
    phoneNumber,
    passwordHash: password, // Will be hashed by pre-save hook
    isAdmin: false
  });
  
  await user.save();
  
  const token = generateToken(user._id, user.isAdmin);
  
  return { user, token };
};

export const registerAdmin = async (adminData) => {
  const { username, email, phoneNumber, password, businessName, address } = adminData;
  
  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }, { phoneNumber }]
  });
  
  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error('Email already registered');
    }
    if (existingUser.username === username) {
      throw new Error('Username already taken');
    }
    if (existingUser.phoneNumber === phoneNumber) {
      throw new Error('Phone number already registered');
    }
  }
  
  // Create new admin user
  const user = new User({
    username,
    email,
    phoneNumber,
    passwordHash: password, // Will be hashed by pre-save hook
    isAdmin: true,
    businessName,
    address
  });
  
  await user.save();
  
  const token = generateToken(user._id, user.isAdmin);
  
  return { user, token };
};

export const loginUser = async (identifier, password) => {
  // Find user by email, username, or phone
  const user = await User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier },
      { phoneNumber: identifier }
    ]
  });
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }
  
  const token = generateToken(user._id, user.isAdmin);
  
  return { user, token };
};

export const updateUserProfile = async (userId, updates) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Check if username is being changed and is unique
  if (updates.username && updates.username !== user.username) {
    const existing = await User.findOne({ username: updates.username });
    if (existing) {
      throw new Error('Username already taken');
    }
    user.username = updates.username;
  }
  
  await user.save();
  
  // Generate new token if username changed
  const token = updates.username ? generateToken(user._id, user.isAdmin) : null;
  
  return { user, token };
};

export const updateAdminProfile = async (userId, updates) => {
  const user = await User.findById(userId);
  
  if (!user || !user.isAdmin) {
    throw new Error('Admin user not found');
  }
  
  let tokenChanged = false;
  
  // Check email uniqueness
  if (updates.email && updates.email !== user.email) {
    const existing = await User.findOne({ email: updates.email });
    if (existing) {
      throw new Error('Email already registered');
    }
    user.email = updates.email;
  }
  
  // Check phone uniqueness
  if (updates.phoneNumber && updates.phoneNumber !== user.phoneNumber) {
    const existing = await User.findOne({ phoneNumber: updates.phoneNumber });
    if (existing) {
      throw new Error('Phone number already registered');
    }
    user.phoneNumber = updates.phoneNumber;
  }
  
  // Check username uniqueness
  if (updates.username && updates.username !== user.username) {
    const existing = await User.findOne({ username: updates.username });
    if (existing) {
      throw new Error('Username already taken');
    }
    user.username = updates.username;
    tokenChanged = true;
  }
  
  // Update other fields
  if (updates.businessName) user.businessName = updates.businessName;
  if (updates.address) user.address = { ...user.address, ...updates.address };
  
  await user.save();
  
  // Generate new token if username changed
  const token = tokenChanged ? generateToken(user._id, user.isAdmin) : null;
  
  return { user, token };
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const isMatch = await user.comparePassword(currentPassword);
  
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }
  
  user.passwordHash = newPassword; // Will be hashed by pre-save hook
  await user.save();
  
  return user;
};
