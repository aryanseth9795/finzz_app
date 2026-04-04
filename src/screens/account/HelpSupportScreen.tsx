import React from "react";
import StaticInfoScreen from "./StaticInfoScreen";
import { helpSections } from "../../constants/accountContent";

const HelpSupportScreen = ({ navigation }: any) => (
  <StaticInfoScreen
    navigation={navigation}
    title="Help & Support"
    icon="help-circle-outline"
    sections={helpSections}
  />
);

export default HelpSupportScreen;
