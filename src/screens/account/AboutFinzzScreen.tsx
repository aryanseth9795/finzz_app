import React from "react";
import StaticInfoScreen from "./StaticInfoScreen";
import { aboutSections } from "../../constants/accountContent";

const AboutFinzzScreen = ({ navigation }: any) => (
  <StaticInfoScreen
    navigation={navigation}
    title="About Finzz"
    icon="information-circle-outline"
    sections={aboutSections}
  />
);

export default AboutFinzzScreen;
