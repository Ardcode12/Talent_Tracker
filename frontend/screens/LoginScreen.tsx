// frontend/screens/LoginScreen.tsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import ApiService from "../services/api";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Theme } from '../constants/Theme';

const { width, height } = Dimensions.get("window");

type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  CoachMain: undefined;
  ProfileCompletion: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();

  // State
  const [userType, setUserType] = useState<'athlete' | 'coach'>('athlete');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    sport: "",
    experience: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});

  // Animation values
  const tabPosition = useSharedValue(0);
  const formOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);

  // Refs
  const scrollRef = useRef<ScrollView>(null);

  // Tab animation style
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabPosition.value * ((width - 64) / 2) }],
  }));

  // Form animation style
  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  // Switch user type with animation
  const switchUserType = (type: 'athlete' | 'coach') => {
    if (type === userType) return;
    
    formOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setUserType)(type);
      runOnJS(resetForm)();
      formOpacity.value = withTiming(1, { duration: 150 });
    });
    
    tabPosition.value = withSpring(type === 'athlete' ? 0 : 1, {
      damping: 15,
      stiffness: 150,
    });
    
    cardScale.value = withSpring(0.98, {}, () => {
      cardScale.value = withSpring(1);
    });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      phone: "",
      sport: "",
      experience: "",
    });
    setErrors({});
  };

  // Validation
  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        newErrors.name = "Name is required";
      }
      if (!formData.phone.trim()) {
        newErrors.phone = "Phone number is required";
      } else if (!/^\d{10}$/.test(formData.phone)) {
        newErrors.phone = "Phone number must be 10 digits";
      }
      
      if (!formData.sport.trim()) {
        newErrors.sport = userType === "athlete" 
          ? "Sport is required" 
          : "Specialization is required";
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check profile completion
  const checkProfileCompletion = (userData: any) => {
    return !!(
      userData.age && 
      userData.location && 
      (userData.profile_image || userData.profile_photo)
    );
  };

  // Handle authentication
  const handleAuth = async () => {
    if (!validateForm()) return;
    setLoading(true);

    try {
      let response;
      
      if (isLogin) {
        // LOGIN FLOW
        response = await ApiService.login(formData.email, formData.password);
        
        if (response && response.token) {
          // ✅ ROLE VALIDATION
          const userRole = response.user.role;
          
          if (userRole !== userType) {
            Alert.alert(
              "Wrong Portal",
              userRole === 'coach' 
                ? "You are registered as a Coach.\nPlease switch to the Coach tab to login."
                : "You are registered as an Athlete.\nPlease switch to the Athlete tab to login.",
              [{ text: "OK" }]
            );
            setLoading(false);
            return;
          }

          // Save login data
          await AsyncStorage.setItem('authToken', response.token);
          await AsyncStorage.setItem('userData', JSON.stringify(response.user));
          await AsyncStorage.setItem('isLoggedIn', 'true');
          await AsyncStorage.setItem('userRole', response.user.role);
          
          // Check profile completion
          const isProfileComplete = checkProfileCompletion(response.user);
          const profileCompletedFlag = await AsyncStorage.getItem('profileCompleted');
          const userSpecificFlag = await AsyncStorage.getItem(`profile_completed_${response.user.id}`);
          
          if (isProfileComplete || profileCompletedFlag === 'true' || userSpecificFlag === 'true' || profileCompletedFlag === 'skipped') {
            await AsyncStorage.setItem('profileCompleted', 'true');
            
            if (response.user.role === 'coach') {
              navigation.reset({
                index: 0,
                routes: [{ name: 'CoachMain' }],
              });
            } else {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            }
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'ProfileCompletion' }],
            });
          }
        }
      } else {
        // SIGNUP FLOW
        const signupData = {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          role: userType,
          sport: formData.sport,
          experience: userType === 'coach' && formData.experience 
            ? parseInt(formData.experience, 10) 
            : null,
          specialization: userType === 'coach' ? formData.sport : null
        };
        
        response = await ApiService.signup(signupData);
        
        if (response && response.token) {
          await AsyncStorage.setItem('authToken', response.token);
          await AsyncStorage.setItem('userData', JSON.stringify(response.user));
          await AsyncStorage.setItem('isLoggedIn', 'true');
          await AsyncStorage.setItem('userRole', response.user.role);
          
          navigation.reset({
            index: 0,
            routes: [{ name: 'ProfileCompletion' }],
          });
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert("Error", error.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Update form field
  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: "" }));
    }
  };

  // Render input field
  const renderInput = (
    icon: string,
    placeholder: string,
    field: string,
    options: {
      secureTextEntry?: boolean;
      keyboardType?: 'default' | 'email-address' | 'numeric';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      maxLength?: number;
      showToggle?: boolean;
    } = {}
  ) => (
    <Animated.View 
      entering={FadeInUp.delay(100).duration(400)}
      style={styles.inputWrapper}
    >
      <View style={[
        styles.inputContainer,
        errors[field] && styles.inputError,
      ]}>
        <Ionicons 
          name={icon as any} 
          size={20} 
          color={Theme.colors.textSecondary} 
          style={styles.inputIcon} 
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.textSecondary}
          value={formData[field as keyof typeof formData]}
          onChangeText={(value) => updateField(field, value)}
          secureTextEntry={options.secureTextEntry && !showPassword}
          keyboardType={options.keyboardType || 'default'}
          autoCapitalize={options.autoCapitalize || 'sentences'}
          maxLength={options.maxLength}
        />
        {options.showToggle && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Ionicons 
              name={showPassword ? "eye" : "eye-off"} 
              size={20} 
              color={Theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>
      {errors[field] && (
        <Animated.Text 
          entering={FadeIn.duration(200)}
          style={styles.errorText}
        >
          {errors[field]}
        </Animated.Text>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={[Theme.colors.background, '#1a1f35', Theme.colors.background]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Decorative Elements */}
      <View style={styles.decorativeContainer}>
        <View style={[styles.decorativeOrb, styles.orb1]} />
        <View style={[styles.decorativeOrb, styles.orb2]} />
        <View style={[styles.decorativeOrb, styles.orb3]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <Animated.View 
            entering={FadeInDown.duration(800).springify()}
            style={styles.header}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[Theme.colors.primary, Theme.colors.secondary]}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <FontAwesome5 
                  name={userType === 'athlete' ? "running" : "chalkboard-teacher"} 
                  size={40} 
                  color="#fff" 
                />
              </LinearGradient>
            </View>
            
            <Text style={styles.appTitle}>TalentTracker</Text>
            <Text style={styles.appSubtitle}>
              {userType === 'athlete' 
                ? "Track Your Athletic Journey" 
                : "Discover & Nurture Talent"}
            </Text>
          </Animated.View>

          {/* Role Tabs */}
          <Animated.View 
            entering={FadeInUp.delay(200).duration(600)}
            style={styles.tabsContainer}
          >
            <View style={styles.tabsBackground}>
              {/* Animated Tab Indicator */}
              <Animated.View 
                style={[styles.tabIndicator, tabIndicatorStyle]} 
              />
              
              {/* Athlete Tab */}
              <TouchableOpacity
                onPress={() => switchUserType('athlete')}
                style={styles.tab}
                activeOpacity={0.8}
              >
                <FontAwesome5 
                  name="running" 
                  size={18} 
                  color={userType === 'athlete' ? '#fff' : Theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.tabText,
                  userType === 'athlete' && styles.activeTabText
                ]}>
                  Athlete
                </Text>
              </TouchableOpacity>
              
              {/* Coach Tab */}
              <TouchableOpacity
                onPress={() => switchUserType('coach')}
                style={styles.tab}
                activeOpacity={0.8}
              >
                <FontAwesome5 
                  name="chalkboard-teacher" 
                  size={18} 
                  color={userType === 'coach' ? '#fff' : Theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.tabText,
                  userType === 'coach' && styles.activeTabText
                ]}>
                  Coach
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Form Card */}
          <Animated.View 
            style={[styles.formCard, formAnimatedStyle]}
          >
            {/* Form Header */}
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {isLogin ? "Welcome Back!" : "Join TalentTracker"}
              </Text>
              <Text style={styles.formSubtitle}>
                {isLogin 
                  ? `Sign in to your ${userType} account` 
                  : `Create your ${userType} account`}
              </Text>
            </View>

            {/* Portal Badge */}
            <View style={[
              styles.portalBadge, 
              { backgroundColor: userType === 'athlete' ? Theme.colors.primary + '20' : Theme.colors.secondary + '20' }
            ]}>
              <FontAwesome5 
                name={userType === 'athlete' ? "medal" : "clipboard"} 
                size={12} 
                color={userType === 'athlete' ? Theme.colors.primary : Theme.colors.secondary} 
              />
              <Text style={[
                styles.portalBadgeText, 
                { color: userType === 'athlete' ? Theme.colors.primary : Theme.colors.secondary }
              ]}>
                {userType === 'athlete' ? 'Athlete Portal' : 'Coach Portal'}
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formFields}>
              {/* Name - Signup only */}
              {!isLogin && renderInput(
                "person-outline",
                "Full Name",
                "name",
                { autoCapitalize: 'words' }
              )}

              {/* Email */}
              {renderInput(
                "mail-outline",
                "Email Address",
                "email",
                { keyboardType: 'email-address', autoCapitalize: 'none' }
              )}

              {/* Phone - Signup only */}
              {!isLogin && renderInput(
                "call-outline",
                "Phone Number",
                "phone",
                { keyboardType: 'numeric', maxLength: 10 }
              )}

              {/* Sport/Specialization - Signup only */}
              {!isLogin && renderInput(
                "trophy-outline",
                userType === 'athlete' 
                  ? "Your Sport (e.g., Basketball)" 
                  : "Specialization (e.g., Fitness Coach)",
                "sport"
              )}

              {/* Experience - Coach Signup only */}
              {!isLogin && userType === 'coach' && renderInput(
                "time-outline",
                "Years of Experience",
                "experience",
                { keyboardType: 'numeric' }
              )}

              {/* Password */}
              {renderInput(
                "lock-closed-outline",
                "Password",
                "password",
                { secureTextEntry: true, showToggle: true }
              )}

              {/* Confirm Password - Signup only */}
              {!isLogin && renderInput(
                "shield-checkmark-outline",
                "Confirm Password",
                "confirmPassword",
                { secureTextEntry: true }
              )}
            </View>

            {/* Forgot Password */}
            {isLogin && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.8}
              style={styles.submitButtonContainer}
            >
              <LinearGradient
                colors={[Theme.colors.primary, Theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {isLogin ? "Sign In" : "Create Account"}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Toggle Login/Signup */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </Text>
              <TouchableOpacity onPress={() => {
                setIsLogin(!isLogin);
                resetForm();
              }}>
                <Text style={styles.toggleLink}>
                  {isLogin ? "Sign Up" : "Sign In"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialContainer}>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-google" size={22} color={Theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-apple" size={22} color={Theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-facebook" size={22} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Info Section */}
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle-outline" size={16} color={Theme.colors.textSecondary} />
              <Text style={styles.infoText}>
                {userType === 'athlete' 
                  ? "Athletes can track performance, connect with coaches, and showcase talent."
                  : "Coaches can discover talent, manage athletes, and create training programs."}
              </Text>
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View 
            entering={FadeInUp.delay(400).duration(600)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>
              By continuing, you agree to our{' '}
              <Text style={styles.footerLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorativeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  decorativeOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
    backgroundColor: Theme.colors.primary + '15',
  },
  orb2: {
    width: 200,
    height: 200,
    top: height * 0.4,
    left: -80,
    backgroundColor: Theme.colors.secondary + '10',
  },
  orb3: {
    width: 150,
    height: 150,
    bottom: 100,
    right: -50,
    backgroundColor: Theme.colors.accent + '10',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 15,
    color: Theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },

  // Tabs
  tabsContainer: {
    marginBottom: 24,
  },
  tabsBackground: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabIndicator: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Theme.colors.primary,
    top: 4,
    left: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    zIndex: 1,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },

  // Form Card
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Theme.borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  formHeader: {
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    marginBottom: 20,
    gap: 6,
  },
  portalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formFields: {
    gap: 4,
  },

  // Input
  inputWrapper: {
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    height: 54,
  },
  inputError: {
    borderColor: Theme.colors.error,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Theme.colors.text,
    height: '100%',
  },
  eyeButton: {
    padding: 8,
    marginRight: -8,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  // Forgot Password
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Submit Button
  submitButtonContainer: {
    marginTop: 8,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  toggleText: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  toggleLink: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    marginHorizontal: 16,
  },

  // Social
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 52,
    height: 52,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: Theme.colors.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;