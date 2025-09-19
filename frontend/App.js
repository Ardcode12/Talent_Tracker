  import React, { useEffect, useState } from 'react';
  import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
  import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
  import { SafeAreaProvider } from 'react-native-safe-area-context';
  import { Ionicons } from '@expo/vector-icons';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { View, ActivityIndicator } from 'react-native';

  // Import your screens
  import LoginScreen from './screens/LoginScreen';
  import HomeScreen from './screens/HomeScreen';
  import ExploreScreen from './screens/Assestment';
  import ConnectionsScreen from './screens/ConnectionsScreen';
  import OpportunitiesScreen from './screens/OpportunitiesScreen';
  import ProfileScreen from './screens/ProfileScreen';
  import ProfileCompletionScreen from './screens/ProfileCompletionScreen';
  import CreatePostScreen from './screens/CreatePostScreen';

  const Stack = createNativeStackNavigator();
  const Tab = createBottomTabNavigator();

  // Tab Navigator Component
  function TabNavigator() {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            switch (route.name) {
              case 'Home':
                iconName = focused ? 'home' : 'home-outline';
                break;
              case 'Assessments':
                iconName = focused ? 'compass' : 'compass-outline';
                break;
              case 'Connections':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'Opportunities':
                iconName = focused ? 'briefcase' : 'briefcase-outline';
                break;
              case 'Profile':
                iconName = focused ? 'person' : 'person-outline';
                break;
              default:
                iconName = 'alert-circle-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopWidth: 0,
            elevation: 0,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Assessments" component={ExploreScreen} />
        <Tab.Screen name="Connections" component={ConnectionsScreen} />
        <Tab.Screen name="Opportunities" component={OpportunitiesScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    );
  }

  export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [initialRoute, setInitialRoute] = useState('Login');

    const clearAuthData = async () => {
      try {
        await AsyncStorage.multiRemove(['authToken', 'userData', 'isLoggedIn', 'profileCompleted']);
        console.log('Auth data cleared');
      } catch (error) {
        console.error('Error clearing auth data:', error);
      }
    };

    const checkAuthStatus = async () => {
      try {
        const [isLoggedIn, profileCompleted, token, userData] = await Promise.all([
          AsyncStorage.getItem('isLoggedIn'),
          AsyncStorage.getItem('profileCompleted'),
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('userData')
        ]);
        
        if (isLoggedIn === 'true' && token !== null) {
          // Parse user data to check profile completion
          let user = null;
          if (userData) {
            try {
              user = JSON.parse(userData);
            } catch (e) {
              console.error('Error parsing user data:', e);
            }
          }

          // Check if profile is actually complete based on user data
          const isProfileComplete = user && !!(
            user.age && 
            user.location && 
            (user.profile_image || user.profile_photo)
          );

          // Check user-specific completion flag
          const userSpecificFlag = user ? await AsyncStorage.getItem(`profile_completed_${user.id}`) : null;

          if (isProfileComplete || profileCompleted === 'true' || userSpecificFlag === 'true') {
            // Profile is complete, go to main
            setInitialRoute('Main');
          } else if (profileCompleted === 'skipped') {
            // User skipped, respect their choice
            setInitialRoute('Main');
          } else {
            // Profile not complete, go to profile completion
            setInitialRoute('ProfileCompletion');
          }
        } else {
          setInitialRoute('Login');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      // clearAuthData(); // Uncomment this to force login screen for testing
      checkAuthStatus();
    }, []);

    if (isLoading) {
      return (
        <SafeAreaProvider>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </SafeAreaProvider>
      );
    }

    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: '#000' },
              animationEnabled: true,
              gestureEnabled: true,
            }}
          >
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{
                animationTypeForReplace: 'push',
              }}
            />
            <Stack.Screen 
              name="ProfileCompletion" 
              component={ProfileCompletionScreen}
              options={{
                animationTypeForReplace: 'push',
                gestureEnabled: false, // Prevent going back
              }}
            />
            <Stack.Screen 
              name="Main" 
              component={TabNavigator}
              options={{
                animationEnabled: false,
                gestureEnabled: false, // Prevent going back to login
              }}
            />
            {/* Add CreatePostScreen here */}
            <Stack.Screen 
              name="CreatePost" 
              component={CreatePostScreen}
              options={{
                animation: 'slide_from_bottom',
                presentation: 'modal',
                headerShown: false,
                gestureEnabled: true,
                cardOverlayEnabled: true,
                cardStyleInterpolator: ({ current: { progress } }) => ({
                  cardStyle: {
                    opacity: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                  overlayStyle: {
                    opacity: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.5],
                      extrapolate: 'clamp',
                    }),
                  },
                }),
              }}
            />
            {/* Add other screens that might be navigated to */}
            <Stack.Screen 
              name="TrendingAthletes" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'Trending Athletes',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="AnnouncementDetail" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'Announcement',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="Comments" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'Comments',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="Assessment" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'AI Assessment',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="UploadVideo" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'Upload Video',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="ViewReports" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'Performance Reports',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="LiveAssessment" 
              component={ExploreScreen} // Use ExploreScreen as placeholder
              options={{
                title: 'Live Assessment',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#1a1a1a',
                },
                headerTintColor: '#fff',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }
