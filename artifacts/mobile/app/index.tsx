import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("@shotdoc_onboarding_done").then((val) => {
      setNeedsOnboarding(!val);
      setChecked(true);
    });
  }, []);

  if (!checked) return null;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(auth)/sign-in" />;
}
