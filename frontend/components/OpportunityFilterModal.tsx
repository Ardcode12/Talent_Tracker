// components/OpportunityFilterModal.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';

interface FilterOption {
  id: string;
  label: string;
  value: string;
  active: boolean;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: {
    sports: FilterOption[];
    types: FilterOption[];
    locations: FilterOption[];
    dates: FilterOption[];
  };
  onFilterChange: (category: string, filterId: string) => void;
}

export const OpportunityFilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  filters,
  onFilterChange,
}) => {
  if (!visible) return null;

  const renderFilterSection = (title: string, options: FilterOption[], category: string) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.filterOption, option.active && styles.filterOptionActive]}
            onPress={() => onFilterChange(category, option.id)}
          >
            <Text style={[
              styles.filterOptionText,
              option.active && styles.filterOptionTextActive
            ]}>{option.label}</Text>
            {option.active && (
              <Ionicons name="checkmark" size={16} color={Theme.colors.text} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <BlurView intensity={100} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Filters</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {renderFilterSection('Sport', filters.sports, 'sports')}
        {renderFilterSection('Type', filters.types, 'types')}
        {renderFilterSection('Location', filters.locations, 'locations')}
        {renderFilterSection('Date', filters.dates, 'dates')}
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={onClose}>
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.elevated,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  content: {
    padding: Theme.spacing.lg,
  },
  filterSection: {
    marginBottom: Theme.spacing.xl,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: Theme.spacing.xs,
  },
  filterOptionActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  filterOptionTextActive: {
    color: Theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  clearButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  applyButton: {
    flex: 2,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.primary,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
});
