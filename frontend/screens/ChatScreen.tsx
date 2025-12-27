// frontend/screens/ChatScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Theme } from '../constants/Theme';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  markConversationRead,
  getImageUrl,
} from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useWebSocket from '../hooks/useWebSocket';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, otherUser } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  const flatListRef = useRef(null);
  
  // WebSocket connection
  const { isConnected, lastMessage } = useWebSocket(conversationId);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'new_message':
          // Only add if not from current user (we add our own messages immediately)
          if (lastMessage.message.sender_id !== currentUserId) {
            setMessages(prev => [...prev, lastMessage.message]);
            scrollToBottom();
          }
          break;
        case 'message_edited':
          setMessages(prev => prev.map(msg => 
            msg.id === lastMessage.message_id 
              ? { ...msg, text: lastMessage.text, edited_at: lastMessage.edited_at }
              : msg
          ));
          break;
        case 'message_deleted':
          setMessages(prev => prev.filter(msg => msg.id !== lastMessage.message_id));
          break;
        case 'messages_read':
          if (lastMessage.reader_id !== currentUserId) {
            setMessages(prev => prev.map(msg => 
              msg.sender_id === currentUserId ? { ...msg, is_read: true } : msg
            ));
          }
          break;
      }
    }
  }, [lastMessage, currentUserId]);

  // Keyboard listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      scrollToBottom();
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCurrentUser();
      loadMessages();
      markAsRead();
    }, [])
  );

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadMessages = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      if (append) setLoadingMore(true);
      
      const response = await getMessages(conversationId, pageNum);
      
      if (response.messages) {
        if (append) {
          // Prepend older messages
          setMessages(prev => [...response.messages, ...prev]);
        } else {
          setMessages(response.messages);
          // Scroll to bottom on initial load
          setTimeout(scrollToBottom, 100);
        }
        setHasMore(response.has_more);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const markAsRead = async () => {
    try {
      await markConversationRead(conversationId);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    
    // Optimistic update - add message immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: currentUserId,
      sender: {
        id: currentUserId,
        name: 'You',
        profile_photo: null,
      },
      text: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
      sending: true, // Flag for UI
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    
    try {
      const newMessage = await sendMessage(conversationId, messageText);
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...newMessage, sending: false } : msg
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setInputText(messageText); // Restore message
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(messageId);
              setMessages(prev => prev.filter(msg => msg.id !== messageId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  };

  const loadMoreMessages = () => {
    if (!loadingMore && hasMore && page > 0) {
      loadMessages(page + 1, true);
    }
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    const showAvatar = !isOwnMessage && (
      index === 0 || 
      messages[index - 1]?.sender_id !== item.sender_id
    );
    const showTimestamp = index === 0 || 
      new Date(item.created_at).getTime() - new Date(messages[index - 1]?.created_at).getTime() > 300000; // 5 min gap

    return (
      <View>
        {showTimestamp && (
          <Text style={styles.timestampDivider}>
            {formatMessageTime(item.created_at)}
          </Text>
        )}
        <View style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        ]}>
          {showAvatar && !isOwnMessage && (
            <Image
              source={{ 
                uri: item.sender?.profile_photo || 
                     otherUser?.profile_photo || 
                     'https://via.placeholder.com/40' 
              }}
              style={styles.messageAvatar}
            />
          )}
          
          <TouchableOpacity
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
              !showAvatar && !isOwnMessage && styles.messageBubbleWithoutAvatar,
              item.sending && styles.sendingBubble
            ]}
            onLongPress={() => isOwnMessage && !item.sending && handleDeleteMessage(item.id)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </Text>
            
            <View style={styles.messageFooter}>
              {item.sending ? (
                <ActivityIndicator size={12} color="rgba(255,255,255,0.7)" />
              ) : (
                <>
                  <Text style={[
                    styles.messageTime,
                    isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
                  ]}>
                    {new Date(item.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                  
                  {isOwnMessage && (
                    <Ionicons 
                      name={item.is_read ? "checkmark-done" : "checkmark"} 
                      size={14} 
                      color={item.is_read ? "#4CAF50" : "rgba(255,255,255,0.5)"} 
                      style={styles.readReceipt}
                    />
                  )}
                </>
              )}
            </View>
            
            {item.edited_at && (
              <Text style={styles.editedLabel}>(edited)</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => navigation.goBack()} 
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.headerContent}
        onPress={() => navigation.navigate('Profile', { userId: otherUser?.id })}
      >
        <Image
          source={{ 
            uri: otherUser?.profile_photo || 
                 otherUser?.profilePhoto || 
                 'https://via.placeholder.com/40' 
          }}
          style={styles.headerAvatar}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherUser?.name || 'User'}</Text>
          <View style={styles.headerStatusRow}>
            {isConnected && (
              <View style={styles.wsIndicator} />
            )}
            <Text style={styles.headerStatus}>
              {otherUser?.is_online ? '🟢 Online' : '⚪ Offline'} • {otherUser?.role || 'User'} • {otherUser?.sport || 'Sport'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.moreButton}>
        <Ionicons name="ellipsis-vertical" size={24} color={Theme.colors.text} />
      </TouchableOpacity>
    </View>
  );

  if (loading && messages.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {renderHeader()}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        onStartReached={loadMoreMessages}
        onStartReachedThreshold={0.5}
        ListHeaderComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={60} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Send a message to start the conversation!
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          if (!loadingMore) scrollToBottom();
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <View style={[styles.inputContainer, keyboardVisible && styles.inputContainerKeyboard]}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="attach" size={24} color={Theme.colors.textSecondary} />
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton, 
            (!inputText.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: 'rgba(20, 27, 45, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wsIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  headerStatus: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  timestampDivider: {
    textAlign: 'center',
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginVertical: 16,
  },
  messageContainer: {
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleWithoutAvatar: {
    marginLeft: 40,
  },
  ownMessageBubble: {
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  sendingBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: Theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 10,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  otherMessageTime: {
    color: Theme.colors.textSecondary,
  },
  readReceipt: {
    marginLeft: 4,
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: Theme.colors.text,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(20, 27, 45, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  inputContainerKeyboard: {
    paddingBottom: Platform.OS === 'ios' ? 12 : 12,
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: Theme.colors.text,
    maxHeight: 120,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});