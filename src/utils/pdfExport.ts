import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { getExpenseExportHtmlApi } from "../api/expenseApi";

export const generateAndSharePDF = async (
  ledgerId: string,
  ledgerName: string,
) => {
  try {
    // Get HTML from backend
    const response = await getExpenseExportHtmlApi(ledgerId);
    const htmlContent = response.data.html;

    // Generate PDF with proper filename
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // Share the PDF (Android users can choose "Save to Downloads" from share menu)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Finzz Expense Report - ${ledgerName}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert(
        "Success",
        "PDF generated but sharing is not available on this device",
      );
    }
  } catch (error: any) {
    console.error("Failed to generate PDF:", error);
    Alert.alert(
      "Error",
      error.response?.data?.message || "Failed to generate PDF",
    );
  }
};
