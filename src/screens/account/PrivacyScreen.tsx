import React from "react";
import StaticInfoScreen from "./StaticInfoScreen";
import { privacySections } from "../../constants/accountContent";

const PrivacyScreen = ({ navigation }: any) => (
  <StaticInfoScreen
    navigation={navigation}
    title="Privacy"
    icon="shield-checkmark-outline"
    sections={privacySections}
  />
);

export default PrivacyScreen;
