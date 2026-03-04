import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

interface VisitConfirmationProps {
  repName: string;
  repEmail: string;
  customerName: string;
  visitDate: string;
  visitDuration: number;
  tasksCompleted: number;
  revenue: number;
  notes?: string;
  nextSuggestedAction?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const VisitConfirmation = ({
  repName,
  repEmail,
  customerName,
  visitDate,
  visitDuration,
  tasksCompleted,
  revenue,
  notes,
  nextSuggestedAction,
}: VisitConfirmationProps) => {
  const visitDateObj = new Date(visitDate);
  const formattedDate = visitDateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Segoe UI"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
            format: "woff2",
          }}
        />
      </Head>
      <Preview>Visit to {customerName} confirmed - {formattedDate}</Preview>

      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Row style={{ width: "100%" }}>
              <Column style={headerColumn}>
                <Img
                  src={`${baseUrl}/logo-white.png`}
                  width="32"
                  height="32"
                  alt="Field Sales Command"
                />
                <Text style={headerText}>Field Sales Command</Text>
              </Column>
              <Column style={{ textAlign: "right" as const, width: "50%" }}>
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: "12px",
                    margin: "0",
                  }}
                >
                  Visit Confirmed ✓
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Main Message */}
          <Section style={section}>
            <Text style={greeting}>
              Great job, {repName}! 👍
            </Text>
            <Text style={subtext}>
              Your visit to {customerName} on {formattedDate} has been recorded.
            </Text>
          </Section>

          {/* Visit Summary Card */}
          <Section style={summarySection}>
            <Row style={{ width: "100%" }}>
              <Column style={summaryLeft}>
                <Text style={summaryLabel}>Customer</Text>
                <Text style={summaryValue}>{customerName}</Text>

                <Text style={{ ...summaryLabel, marginTop: "16px" }}>
                  Date & Time
                </Text>
                <Text style={summaryValue}>{formattedDate}</Text>
              </Column>

              <Column style={summaryRight}>
                <Row style={{ marginBottom: "16px" }}>
                  <Column style={{ width: "50%" }}>
                    <Text style={metricLabel}>Duration</Text>
                    <Text style={metricValue}>{visitDuration} min</Text>
                  </Column>
                  <Column style={{ width: "50%" }}>
                    <Text style={metricLabel}>Tasks</Text>
                    <Text style={metricValue}>{tasksCompleted}</Text>
                  </Column>
                </Row>

                <Row>
                  <Column style={{ width: "100%" }}>
                    <Text style={metricLabel}>Revenue</Text>
                    <Text style={metricValueLarge}>
                      ${revenue.toFixed(2)}
                    </Text>
                  </Column>
                </Row>
              </Column>
            </Row>
          </Section>

          {/* Notes Section */}
          {notes && (
            <Section style={notesSection}>
              <Text style={notesTitle}>Visit Notes</Text>
              <Text style={notesContent}>{notes}</Text>
            </Section>
          )}

          {/* Next Steps */}
          {nextSuggestedAction && (
            <Section style={nextStepsSection}>
              <Text style={nextStepsTitle}>Next Suggested Action</Text>
              <Text style={nextStepsContent}>{nextSuggestedAction}</Text>
            </Section>
          )}

          {/* Quick Stats */}
          <Section style={section}>
            <Text style={sectionTitle}>Today's Progress</Text>

            <Row style={progressRow}>
              <Column style={{ width: "50%" }}>
                <Text style={progressLabel}>Visits Today</Text>
                <Text style={progressValue}>+1</Text>
              </Column>
              <Column style={{ width: "50%", textAlign: "right" as const }}>
                <Text style={progressLabel}>Revenue Today</Text>
                <Text style={progressValue}>+${revenue.toFixed(2)}</Text>
              </Column>
            </Row>
          </Section>

          {/* CTA */}
          <Section style={section}>
            <Button style={ctaButton}>
              <Link
                href={`${baseUrl}/dashboard`}
                style={ctaButtonText}
              >
                View Dashboard
              </Link>
            </Button>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footerSection}>
            <Text style={footerText}>
              This visit has been synced to your profile and the leaderboard.
            </Text>
            <Text style={footerText}>
              © 2024 Field Sales Command. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif",
  lineHeight: "1.5",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  maxWidth: "600px",
  margin: "0 auto",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const headerSection: React.CSSProperties = {
  backgroundColor: "#059669",
  padding: "24px",
};

const headerColumn: React.CSSProperties = {
  display: "flex" as const,
  alignItems: "center",
  gap: "12px",
  width: "50%",
};

const headerText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: "700",
  margin: "0",
};

const section: React.CSSProperties = {
  padding: "32px 24px",
};

const greeting: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "0 0 8px 0",
};

const subtext: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  margin: "0",
};

const summarySection: React.CSSProperties = {
  ...section,
  backgroundColor: "#f0fdf4",
  borderLeft: "4px solid #10b981",
  paddingBottom: "24px",
};

const summaryLeft: React.CSSProperties = {
  width: "60%",
};

const summaryRight: React.CSSProperties = {
  width: "40%",
  paddingLeft: "24px",
};

const summaryLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#6b7280",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0 0 4px 0",
};

const summaryValue: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1f2937",
  margin: "0",
};

const metricLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0",
};

const metricValue: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#059669",
  margin: "4px 0 0 0",
};

const metricValueLarge: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#059669",
  margin: "4px 0 0 0",
};

const notesSection: React.CSSProperties = {
  ...section,
  backgroundColor: "#f3f4f6",
  borderLeft: "4px solid #3b82f6",
};

const notesTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "0 0 8px 0",
};

const notesContent: React.CSSProperties = {
  fontSize: "13px",
  color: "#4b5563",
  margin: "0",
  lineHeight: "1.6",
};

const nextStepsSection: React.CSSProperties = {
  ...section,
  backgroundColor: "#fef3c7",
  borderLeft: "4px solid #f59e0b",
};

const nextStepsTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#92400e",
  margin: "0 0 8px 0",
};

const nextStepsContent: React.CSSProperties = {
  fontSize: "13px",
  color: "#b45309",
  margin: "0",
  lineHeight: "1.6",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "0 0 16px 0",
};

const progressRow: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  padding: "16px",
  borderRadius: "6px",
  display: "flex" as const,
};

const progressLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0 0 8px 0",
};

const progressValue: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#059669",
  margin: "0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#059669",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "600",
  fontSize: "14px",
  display: "inline-block" as const,
};

const ctaButtonText: React.CSSProperties = {
  color: "#ffffff",
  textDecoration: "none",
};

const divider: React.CSSProperties = {
  margin: "0",
  borderTop: "1px solid #e5e7eb",
};

const footerSection: React.CSSProperties = {
  padding: "24px",
  textAlign: "center" as const,
  backgroundColor: "#f9fafb",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "8px 0",
};

export default VisitConfirmation;
