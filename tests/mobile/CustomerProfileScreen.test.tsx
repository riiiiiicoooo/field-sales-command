/**
 * Tests for CustomerProfileScreen component
 * Uses React Native Testing Library for comprehensive coverage
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerProfileScreen } from "../../../mobile/app/screens/CustomerProfileScreen";
import * as customerApi from "../../../mobile/app/services/customerApi";

// Mock dependencies
jest.mock("../../../mobile/app/services/customerApi");
jest.mock("@react-native-async-storage/async-storage");

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: { customerId: "CUST001", customerName: "Acme Corp" },
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe("CustomerProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  describe("Rendering with mock customer data", () => {
    it("should render customer profile with basic information", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [
          { orderNumber: "ORD001", date: "2024-02-01", amount: 1500 },
        ],
        openOpportunities: [
          {
            id: "OPP001",
            name: "Expansion",
            stage: "Proposal",
            amount: 5000,
          },
        ],
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeTruthy();
        expect(screen.getByText("$5,000")).toBeTruthy(); // Account balance
        expect(screen.getByText("$25,000")).toBeTruthy(); // LTV
      });
    });

    it("should display churn probability warning when high", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.75, // High churn risk
        recentOrders: [],
        openOpportunities: [],
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        const warningElement = screen.queryByTestId("churn-warning");
        expect(warningElement).toBeTruthy();
      });
    });

    it("should display recent orders list", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [
          { orderNumber: "ORD001", date: "2024-02-01", amount: 1500 },
          { orderNumber: "ORD002", date: "2024-01-15", amount: 2000 },
        ],
        openOpportunities: [],
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText("ORD001")).toBeTruthy();
        expect(screen.getByText("ORD002")).toBeTruthy();
      });
    });
  });

  describe("Pull-to-refresh functionality", () => {
    it("should refresh customer data on pull-to-refresh", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
      };

      (customerApi.getCustomerProfile as jest.Mock)
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce({
          ...mockCustomer,
          accountBalance: 6000, // Updated balance
        });

      const { rerender } = renderWithProviders(
        <CustomerProfileScreen />
      );

      await waitFor(() => {
        expect(screen.getByText("$5,000")).toBeTruthy();
      });

      // Simulate pull-to-refresh
      const refreshControl = screen.getByTestId("refresh-control");
      fireEvent(refreshControl, "refresh");

      await waitFor(() => {
        expect(screen.getByText("$6,000")).toBeTruthy();
      });
    });

    it("should show loading state during refresh", async () => {
      (customerApi.getCustomerProfile as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  customerId: "CUST001",
                  name: "Acme Corp",
                  accountBalance: 5000,
                  ltv: 25000,
                  churnProbability: 0.05,
                  recentOrders: [],
                  openOpportunities: [],
                }),
              100
            )
          )
      );

      renderWithProviders(<CustomerProfileScreen />);

      const refreshControl = screen.getByTestId("refresh-control");
      fireEvent(refreshControl, "refresh");

      expect(screen.getByTestId("refresh-spinner")).toBeTruthy();

      await waitFor(() => {
        expect(screen.queryByTestId("refresh-spinner")).toBeFalsy();
      });
    });
  });

  describe("Offline indicator display", () => {
    it("should display offline banner when no connectivity", async () => {
      jest.mock("../../../mobile/app/hooks/useNetworkStatus", () => ({
        useNetworkStatus: () => ({ isConnected: false }),
      }));

      renderWithProviders(<CustomerProfileScreen />);

      const offlineIndicator = screen.queryByTestId("offline-indicator");
      expect(offlineIndicator).toBeTruthy();
    });

    it("should show stale data warning when offline", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      jest.mock("../../../mobile/app/hooks/useNetworkStatus", () => ({
        useNetworkStatus: () => ({ isConnected: false }),
      }));

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        const staleWarning = screen.queryByTestId("stale-data-warning");
        expect(staleWarning).toBeTruthy();
      });
    });

    it("should hide offline indicator when back online", async () => {
      let isConnected = false;
      const mockUseNetworkStatus = jest.fn(() => ({ isConnected }));

      jest.mock("../../../mobile/app/hooks/useNetworkStatus", () => ({
        useNetworkStatus: mockUseNetworkStatus,
      }));

      const { rerender } = renderWithProviders(
        <CustomerProfileScreen />
      );

      expect(screen.queryByTestId("offline-indicator")).toBeTruthy();

      // Simulate coming back online
      isConnected = true;
      rerender(<CustomerProfileScreen />);

      expect(screen.queryByTestId("offline-indicator")).toBeFalsy();
    });
  });

  describe("Action buttons functionality", () => {
    it("should render call button", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
        phoneNumber: "555-1234",
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.getByTestId("call-button")).toBeTruthy();
      });
    });

    it("should render email button", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
        email: "contact@acmecorp.com",
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.getByTestId("email-button")).toBeTruthy();
      });
    });

    it("should call customer when call button pressed", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
        phoneNumber: "555-1234",
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        const callButton = screen.getByTestId("call-button");
        fireEvent.press(callButton);
      });

      // Verify calling service was invoked
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });

    it("should open email when email button pressed", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
        email: "contact@acmecorp.com",
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        const emailButton = screen.getByTestId("email-button");
        fireEvent.press(emailButton);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });
  });

  describe("Loading states", () => {
    it("should show skeleton loading on initial load", () => {
      (customerApi.getCustomerProfile as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<CustomerProfileScreen />);

      expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
    });

    it("should hide skeleton after data loads", async () => {
      const mockCustomer = {
        customerId: "CUST001",
        name: "Acme Corp",
        accountBalance: 5000,
        ltv: 25000,
        churnProbability: 0.05,
        recentOrders: [],
        openOpportunities: [],
      };

      (customerApi.getCustomerProfile as jest.Mock).mockResolvedValue(
        mockCustomer
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-skeleton")).toBeFalsy();
      });
    });

    it("should show error message on fetch failure", async () => {
      (customerApi.getCustomerProfile as jest.Mock).mockRejectedValue(
        new Error("Failed to fetch")
      );

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.getByTestId("error-message")).toBeTruthy();
        expect(screen.getByText(/failed to load/i)).toBeTruthy();
      });
    });

    it("should allow retry on error", async () => {
      (customerApi.getCustomerProfile as jest.Mock)
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce({
          customerId: "CUST001",
          name: "Acme Corp",
          accountBalance: 5000,
          ltv: 25000,
          churnProbability: 0.05,
          recentOrders: [],
          openOpportunities: [],
        });

      renderWithProviders(<CustomerProfileScreen />);

      await waitFor(() => {
        expect(screen.getByTestId("error-message")).toBeTruthy();
      });

      const retryButton = screen.getByTestId("retry-button");
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeTruthy();
      });
    });
  });
});
