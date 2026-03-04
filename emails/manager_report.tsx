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

interface RepPerformance {
  repId: string;
  name: string;
  visits: number;
  revenue: number;
  conversionRate: number;
  taskCompletionRate: number;
}

interface ManagerReportProps {
  managerName: string;
  managerEmail: string;
  division: string;
  totalVisits: number;
  totalRevenue: number;
  avgConversionRate: number;
  topPerformer: RepPerformance;
  underperformers: RepPerformance[];
  upcomingSchedule: Array<{
    date: string;
    scheduledServices: number;
    assignedReps: number;
  }>;
  weekNumber: number;
  year: number;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const ManagerReport = ({
  managerName,
  managerEmail,
  division,
  totalVisits,
  totalRevenue,
  avgConversionRate,
  topPerformer,
  underperformers,
  upcomingSchedule,
  weekNumber,
  year,
}: ManagerReportProps) => {
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
      <Preview>
        Weekly team performance report for {division} division (Week {weekNumber},
        {year})
      </Preview>

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
                  Week {weekNumber}, {year}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Greeting */}
          <Section style={section}>
            <Text style={greeting}>
              Hey {managerName},
            </Text>
            <Text style={subtext}>
              Here's your team performance summary for {division} division
            </Text>
          </Section>

          {/* Key Metrics */}
          <Section style={metricsSection}>
            <Row style={{ width: "100%" }}>
              <Column style={metricCard}>
                <Text style={metricLabel}>Total Visits</Text>
                <Text style={metricValue}>{totalVisits}</Text>
              </Column>
              <Column style={metricCard}>
                <Text style={metricLabel}>Revenue Generated</Text>
                <Text style={metricValue}>
                  ${(totalRevenue / 1000).toFixed(1)}k
                </Text>
              </Column>
              <Column style={metricCard}>
                <Text style={metricLabel}>Avg Conversion Rate</Text>
                <Text style={metricValue}>
                  {(avgConversionRate * 100).toFixed(1)}%
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Top Performer Spotlight */}
          <Section style={section}>
            <Text style={sectionTitle}>🏆 Top Performer Spotlight</Text>

            <Row style={topPerformerCard}>
              <Column style={{ width: "100%" }}>
                <Row style={{ marginBottom: "12px" }}>
                  <Column style={{ width: "50%" }}>
                    <Text style={performerName}>{topPerformer.name}</Text>
                  </Column>
                  <Column style={{ width: "50%", textAlign: "right" as const }}>
                    <Text
                      style={{
                        ...badge,
                        backgroundColor: "#10b981",
                      }}
                    >
                      #1 Performer
                    </Text>
                  </Column>
                </Row>

                <Row style={{ marginBottom: "8px" }}>
                  <Column style={{ width: "33%" }}>
                    <Text style={performerMetricLabel}>Visits</Text>
                    <Text style={performerMetricValue}>
                      {topPerformer.visits}
                    </Text>
                  </Column>
                  <Column style={{ width: "33%" }}>
                    <Text style={performerMetricLabel}>Revenue</Text>
                    <Text style={performerMetricValue}>
                      ${(topPerformer.revenue / 1000).toFixed(1)}k
                    </Text>
                  </Column>
                  <Column style={{ width: "33%" }}>
                    <Text style={performerMetricLabel}>Conversion</Text>
                    <Text style={performerMetricValue}>
                      {(topPerformer.conversionRate * 100).toFixed(0)}%
                    </Text>
                  </Column>
                </Row>

                <Text style={performerNote}>
                  {topPerformer.name} is leading the division with outstanding
                  performance. Consider recognizing them and capturing their best practices.
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Underperformers Alert */}
          {underperformers.length > 0 && (
            <Section style={alertSection}>
              <Text style={sectionTitle}>⚠️ Underperformer Alert</Text>

              {underperformers.map((rep, index) => (
                <Row
                  key={index}
                  style={{
                    ...underperformerRow,
                    borderBottom:
                      index < underperformers.length - 1
                        ? "1px solid #fecaca"
                        : "none",
                  }}
                >
                  <Column style={{ width: "50%" }}>
                    <Text style={underperformerName}>{rep.name}</Text>
                    <Text style={underperformerMetric}>
                      Task Completion: {(rep.taskCompletionRate * 100).toFixed(0)}%
                    </Text>
                  </Column>
                  <Column style={{ width: "50%", textAlign: "right" as const }}>
                    <Text
                      style={{
                        ...badge,
                        backgroundColor: "#ef4444",
                      }}
                    >
                      {rep.taskCompletionRate < 0.5
                        ? "Below 50%"
                        : "Below Target"}
                    </Text>
                  </Column>
                </Row>
              ))}

              <Text style={alertNote}>
                These reps need coaching. Review their activity and identify blockers.
              </Text>
            </Section>
          )}

          {/* Upcoming Schedule */}
          <Section style={section}>
            <Text style={sectionTitle}>📅 Upcoming Schedule (Next 7 Days)</Text>

            {upcomingSchedule.map((day, index) => (
              <Row
                key={index}
                style={{
                  ...scheduleRow,
                  borderBottom:
                    index < upcomingSchedule.length - 1
                      ? "1px solid #e5e7eb"
                      : "none",
                }}
              >
                <Column style={{ width: "40%" }}>
                  <Text style={scheduleDate}>{day.date}</Text>
                </Column>
                <Column style={{ width: "30%", textAlign: "center" as const }}>
                  <Text style={scheduleMetric}>
                    {day.scheduledServices} services
                  </Text>
                </Column>
                <Column style={{ width: "30%", textAlign: "right" as const }}>
                  <Text style={scheduleMetric}>
                    {day.assignedReps} reps
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Action Items */}
          <Section style={section}>
            <Text style={sectionTitle}>Next Steps</Text>

            <Row style={actionItem}>
              <Column style={{ width: "20px" }}>
                <Text style={{ margin: "0" }}>1.</Text>
              </Column>
              <Column style={{ width: "calc(100% - 20px)" }}>
                <Text style={{ margin: "0" }}>
                  Schedule coaching sessions with underperformers
                </Text>
              </Column>
            </Row>

            <Row style={actionItem}>
              <Column style={{ width: "20px" }}>
                <Text style={{ margin: "0" }}>2.</Text>
              </Column>
              <Column style={{ width: "calc(100% - 20px)" }}>
                <Text style={{ margin: "0" }}>
                  Review {topPerformer.name}'s best practices with the team
                </Text>
              </Column>
            </Row>

            <Row style={actionItem}>
              <Column style={{ width: "20px" }}>
                <Text style={{ margin: "0" }}>3.</Text>
              </Column>
              <Column style={{ width: "calc(100% - 20px)" }}>
                <Text style={{ margin: "0" }}>
                  Verify upcoming schedule coverage and adjust as needed
                </Text>
              </Column>
            </Row>
          </Section>

          {/* CTA */}
          <Section style={section}>
            <Button style={ctaButton}>
              <Link
                href={`${baseUrl}/manager/team?division=${division}`}
                style={ctaButtonText}
              >
                View Full Team Dashboard
              </Link>
            </Button>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2024 Field Sales Command. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href={`${baseUrl}/account/notifications`} style={footerLink}>
                Manage preferences
              </Link>
              {" • "}
              <Link href={`${baseUrl}/help`} style={footerLink}>
                Help
              </Link>
              {" • "}
              <Link href={`${baseUrl}/contact`} style={footerLink}>
                Contact
              </Link>
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
  backgroundColor: "#1f2937",
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

const metricsSection: React.CSSProperties = {
  ...section,
  backgroundColor: "#f3f4f6",
  paddingBottom: "24px",
};

const metricCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "16px",
  borderRadius: "6px",
  textAlign: "center" as const,
  marginRight: "12px",
};

const metricLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0",
};

const metricValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "8px 0 0 0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "0 0 16px 0",
};

const topPerformerCard: React.CSSProperties = {
  backgroundColor: "#f0fdf4",
  padding: "16px",
  borderRadius: "6px",
  borderLeft: "4px solid #10b981",
};

const badge: React.CSSProperties = {
  display: "inline-block" as const,
  padding: "4px 8px",
  borderRadius: "4px",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: "600",
  textTransform: "uppercase" as const,
};

const performerName: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#065f46",
  margin: "0",
};

const performerMetricLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#6b7280",
  fontWeight: "600",
  textTransform: "uppercase" as const,
  margin: "0",
};

const performerMetricValue: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#1f2937",
  margin: "4px 0 0 0",
};

const performerNote: React.CSSProperties = {
  fontSize: "13px",
  color: "#065f46",
  fontStyle: "italic" as const,
  margin: "12px 0 0 0",
};

const alertSection: React.CSSProperties = {
  ...section,
  backgroundColor: "#fef2f2",
  borderLeft: "4px solid #ef4444",
};

const underperformerRow: React.CSSProperties = {
  padding: "12px 0",
  display: "flex" as const,
};

const underperformerName: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#991b1b",
  margin: "0",
};

const underperformerMetric: React.CSSProperties = {
  fontSize: "12px",
  color: "#dc2626",
  margin: "4px 0 0 0",
};

const alertNote: React.CSSProperties = {
  fontSize: "13px",
  color: "#991b1b",
  fontStyle: "italic" as const,
  margin: "12px 0 0 0",
};

const scheduleRow: React.CSSProperties = {
  padding: "12px 0",
  display: "flex" as const,
};

const scheduleDate: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1f2937",
  margin: "0",
};

const scheduleMetric: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0",
};

const actionItem: React.CSSProperties = {
  marginBottom: "12px",
  display: "flex" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#3b82f6",
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

const footerLink: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
};

export default ManagerReport;
