import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { createPoolApi } from "../../api/poolApi";

const CreatePoolScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Pool name is required");
      return;
    }

    try {
      setLoading(true);
      const res = await createPoolApi({
        name: name.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
      });

      if (res.data.success) {
        Alert.alert("Success", "Pool created successfully!");
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create pool",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.text, fontSize: fs.xl },
            ]}
          >
            Create Pool
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Form */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Pool Name */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Pool Name <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: fs.md,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Goa Trip 2026"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoFocus
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Description (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: fs.md,
                  borderColor: colors.border,
                },
              ]}
              placeholder="What is this pool for?"
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Rules */}
          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              Rules (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: fs.md,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Set any rules or guidelines for this pool"
              placeholderTextColor={colors.textTertiary}
              value={rules}
              onChangeText={setRules}
              maxLength={1000}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Helper Text */}
          <View
            style={[styles.infoBox, { backgroundColor: colors.primarySurface }]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.primary}
            />
            <Text
              style={[
                styles.infoText,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              You'll be the admin of this pool. You can add members after
              creation.
            </Text>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.createButton,
              {
                backgroundColor: colors.primary,
                opacity: !name.trim() || loading ? 0.5 : 1,
              },
            ]}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.createButtonText, { fontSize: fs.md }]}>
                Create Pool
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontWeight: "400",
  },
  textArea: {
    minHeight: 100,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    lineHeight: 20,
  },
  createButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default CreatePoolScreen;
