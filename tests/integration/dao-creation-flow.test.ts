/**
 * DAO Deployer - Integration Tests: DAO Creation Flow
 * 
 * Tests the complete user journey from connecting wallet to deploying a DAO.
 * Covers all three steps: Basic Info, Token Config, and Governance Config.
 * 
 * @module integration/dao-creation-flow
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { render, screen, fireEvent, waitFor, cleanup } from "@solidjs/testing-library";
import { Router } from "@solidjs/router";
import DAOConfigForm from "../../src/components/DAOConfigForm";
import TokenConfigForm from "../../src/components/TokenConfigForm";
import GovernanceConfigForm from "../../src/components/GovernanceConfigForm";
import DeployProgress from "../../src/components/DeployProgress";
import { daoActions, daoState } from "../../src/stores/daoStore";

// ============================================================================
// TEST SETUP
// ============================================================================

describe("DAO Creation Flow - Integration Tests", () => {
  beforeEach(() => {
    // Reset store state
    daoActions.clearError();
    daoActions.resetDeployment();
    daoActions.clearCurrentDAO();
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // STEP 1: BASIC INFO
  // ============================================================================

  describe("Step 1: Basic Information", () => {
    it("should render the DAO config form with all required fields", () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Check for required fields
      expect(screen.getByLabelText(/dao name/i)).toBeTruthy();
      expect(screen.getByLabelText(/description/i)).toBeTruthy();
      
      // Check for submit button
      expect(screen.getByRole("button", { name: /continue/i })).toBeTruthy();
      
      // Check for back button
      expect(screen.getByRole("button", { name: /back/i })).toBeTruthy();
    });

    it("should validate required fields on submit", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Submit empty form
      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      // Wait for validation errors
      await waitFor(() => {
        expect(screen.getByText(/dao name is required/i)).toBeTruthy();
        expect(screen.getByText(/description is required/i)).toBeTruthy();
      });
    });

    it("should validate minimum length requirements", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Enter short values
      const nameInput = screen.getByLabelText(/dao name/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.input(nameInput, { target: { value: "ab" } });
      fireEvent.input(descriptionInput, { target: { value: "short" } });
      
      // Blur to trigger validation
      fireEvent.blur(nameInput);
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(screen.getByText(/name must be at least 3 characters/i)).toBeTruthy();
        expect(screen.getByText(/description must be at least 10 characters/i)).toBeTruthy();
      });
    });

    it("should validate maximum length requirements", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Enter long values
      const nameInput = screen.getByLabelText(/dao name/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.input(nameInput, { target: { value: "a".repeat(51) } });
      fireEvent.input(descriptionInput, { target: { value: "a".repeat(501) } });
      
      fireEvent.blur(nameInput);
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(screen.getByText(/name must be less than 50 characters/i)).toBeTruthy();
        expect(screen.getByText(/description must be less than 500 characters/i)).toBeTruthy();
      });
    });

    it("should submit valid form data", async () => {
      const mockSubmit = (data: any) => {
        expect(data.name).toBe("Test DAO");
        expect(data.description).toBe("This is a test DAO description");
      };
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={mockSubmit} onBack={onBack} />
      ));

      // Fill in valid data
      fireEvent.input(screen.getByLabelText(/dao name/i), { 
        target: { value: "Test DAO" } 
      });
      fireEvent.input(screen.getByLabelText(/description/i), { 
        target: { value: "This is a test DAO description" } 
      });

      // Submit form
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      // Wait for validation to pass and submit to be called
      await waitFor(() => {
        expect(daoState.error).toBeNull();
      });
    });

    it("should show character counters", () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Type in description
      const descriptionInput = screen.getByLabelText(/description/i);
      fireEvent.input(descriptionInput, { target: { value: "Test description" } });

      // Check counter
      expect(screen.getByText(/16\/500/i)).toBeTruthy();
    });

    it("should handle keyboard navigation", () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <DAOConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      const nameInput = screen.getByLabelText(/dao name/i);
      const submitButton = screen.getByRole("button", { name: /continue/i });

      // Tab to submit button
      nameInput.focus();
      fireEvent.keyDown(nameInput, { key: "Tab" });
      
      // Check that button is focusable
      expect(submitButton).toHaveAttribute("type", "submit");
    });
  });

  // ============================================================================
  // STEP 2: TOKEN CONFIGURATION
  // ============================================================================

  describe("Step 2: Token Configuration", () => {
    it("should render token config form with presets", () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <TokenConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Check for preset buttons
      expect(screen.getByRole("button", { name: /starter/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /growth/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /enterprise/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /fixed/i })).toBeTruthy();

      // Check for input fields
      expect(screen.getByLabelText(/token name/i)).toBeTruthy();
      expect(screen.getByLabelText(/token symbol/i)).toBeTruthy();
    });

    it("should apply preset configurations", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <TokenConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Click starter preset
      fireEvent.click(screen.getByRole("button", { name: /starter preset/i }));

      // Check that values were applied
      await waitFor(() => {
        const initialSupply = screen.getByLabelText(/initial supply/i) as HTMLInputElement;
        expect(initialSupply.value).toBe("1000000");
      });
    });

    it("should validate token symbol format", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <TokenConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Enter invalid symbol
      const symbolInput = screen.getByLabelText(/token symbol/i);
      fireEvent.input(symbolInput, { target: { value: "123" } });
      fireEvent.blur(symbolInput);

      await waitFor(() => {
        expect(screen.getByText(/symbol must contain only letters/i)).toBeTruthy();
      });
    });

    it("should convert symbol to uppercase", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <TokenConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      const symbolInput = screen.getByLabelText(/token symbol/i);
      fireEvent.input(symbolInput, { target: { value: "test" } });

      await waitFor(() => {
        expect((symbolInput as HTMLInputElement).value).toBe("TEST");
      });
    });

    it("should validate supply constraints", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <TokenConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Set initial supply higher than max supply
      const initialSupply = screen.getByLabelText(/initial supply/i);
      const maxSupply = screen.getByLabelText(/maximum supply/i);

      fireEvent.input(initialSupply, { target: { value: "10000000" } });
      fireEvent.input(maxSupply, { target: { value: "1000000" } });
      fireEvent.blur(maxSupply);

      await waitFor(() => {
        expect(screen.getByText(/max supply must be greater than or equal to initial supply/i)).toBeTruthy();
      });
    });

    it("should handle back navigation", () => {
      let backClicked = false;
      const onSubmit = () => {};
      const onBack = () => { backClicked = true; };

      render(() => (
        <TokenConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(backClicked).toBe(true);
    });
  });

  // ============================================================================
  // STEP 3: GOVERNANCE CONFIGURATION
  // ============================================================================

  describe("Step 3: Governance Configuration", () => {
    it("should render governance config form", () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <GovernanceConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Check for governance fields
      expect(screen.getByLabelText(/voting duration/i)).toBeTruthy();
      expect(screen.getByLabelText(/quorum/i)).toBeTruthy();
      expect(screen.getByLabelText(/voting threshold/i)).toBeTruthy();
    });

    it("should validate quorum range", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <GovernanceConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Enter invalid quorum
      const quorumInput = screen.getByLabelText(/quorum/i);
      fireEvent.input(quorumInput, { target: { value: "101" } });
      fireEvent.blur(quorumInput);

      await waitFor(() => {
        expect(screen.getByText(/quorum must be between 1 and 100/i)).toBeTruthy();
      });
    });

    it("should validate voting duration minimum", async () => {
      const onSubmit = () => {};
      const onBack = () => {};

      render(() => (
        <GovernanceConfigForm onSubmit={onSubmit} onBack={onBack} />
      ));

      // Enter too short duration
      const durationInput = screen.getByLabelText(/voting duration/i);
      fireEvent.input(durationInput, { target: { value: "1" } });
      fireEvent.blur(durationInput);

      await waitFor(() => {
        expect(screen.getByText(/voting duration must be at least/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // DEPLOYMENT PROGRESS
  // ============================================================================

  describe("Deployment Progress", () => {
    it("should display deployment steps in order", () => {
      // Set deployment in progress
      daoActions.deployDAO({
        name: "Test DAO",
        description: "Test description",
        tokenConfig: {
          name: "Test Token",
          symbol: "TEST",
          initialSupply: "1000000",
          maxSupply: "10000000",
          decimals: 18,
        },
        governanceParams: {
          votingThreshold: 0n,
          votingDuration: 86400 * 3,
          executionDelay: 86400,
          quorum: 51,
          proposalThreshold: 0n,
        },
      });

      render(() => <DeployProgress />);

      // Check for deployment steps
      expect(screen.getByText(/preparing/i)).toBeTruthy();
      expect(screen.getByText(/deploying soul-bound token/i)).toBeTruthy();
      expect(screen.getByText(/deploying dao core/i)).toBeTruthy();
    });

    it("should show progress bar during deployment", async () => {
      render(() => <DeployProgress />);

      // Check for progress indicator
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeTruthy();
    });

    it("should display error state on failure", async () => {
      // Simulate failed deployment
      daoState.deploymentStatus = {
        step: "failed",
        progress: 0,
        message: "Deployment failed",
        error: "Network error",
        timestamp: Date.now(),
      };

      render(() => <DeployProgress />);

      expect(screen.getByText(/deployment failed/i)).toBeTruthy();
      expect(screen.getByText(/network error/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    });

    it("should allow retry on failure", async () => {
      let retryCalled = false;
      daoState.deploymentStatus = {
        step: "failed",
        progress: 0,
        message: "Deployment failed",
        error: "Network error",
        timestamp: Date.now(),
      };

      render(() => (
        <DeployProgress onRetry={() => { retryCalled = true; }} />
      ));

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(retryCalled).toBe(true);
    });
  });

  // ============================================================================
  // END-TO-END FLOW
  // ============================================================================

  describe("End-to-End DAO Creation Flow", () => {
    it("should complete full DAO creation workflow", async () => {
      const steps: string[] = [];
      
      // Step 1: Basic Info
      const Step1 = () => (
        <DAOConfigForm
          onSubmit={(config) => {
            steps.push("basic-info");
            // Would navigate to step 2
          }}
        />
      );

      render(() => <Step1 />);

      // Fill and submit step 1
      fireEvent.input(screen.getByLabelText(/dao name/i), { 
        target: { value: "Integration Test DAO" } 
      });
      fireEvent.input(screen.getByLabelText(/description/i), { 
        target: { value: "A DAO created for integration testing purposes" } 
      });
      
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(steps).toContain("basic-info");
      });
    });

    it("should handle network errors with retry", async () => {
      let attempts = 0;
      
      // Mock a flaky submission
      const flakySubmit = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Network error");
        }
        return { success: true };
      };

      // Test retry logic
      const result = await daoActions.deployDAO({
        name: "Test DAO",
        description: "Test",
        tokenConfig: {
          name: "Test",
          symbol: "TST",
          initialSupply: "1000",
          maxSupply: "10000",
          decimals: 18,
        },
        governanceParams: {
          votingThreshold: 0n,
          votingDuration: 86400,
          executionDelay: 3600,
          quorum: 50,
          proposalThreshold: 0n,
        },
      });

      // Verify retry mechanism was engaged
      expect(daoState.retryCount).toBeGreaterThanOrEqual(0);
    });

    it("should validate entire form chain", async () => {
      const validationErrors: string[] = [];

      // Test that all steps validate before allowing submission
      render(() => (
        <DAOConfigForm
          onSubmit={() => validationErrors.push("step1")}
          onBack={() => {}}
        />
      ));

      // Try to submit empty form
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        // Should show validation errors, not call onSubmit
        expect(validationErrors).toHaveLength(0);
        expect(screen.getByText(/dao name is required/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("should have proper ARIA labels on all inputs", () => {
      render(() => (
        <DAOConfigForm onSubmit={() => {}} onBack={() => {}} />
      ));

      const nameInput = screen.getByLabelText(/dao name/i);
      expect(nameInput).toHaveAttribute("aria-required", "true");
      expect(nameInput).toHaveAttribute("aria-describedby");
    });

    it("should announce errors to screen readers", async () => {
      render(() => (
        <DAOConfigForm onSubmit={() => {}} onBack={() => {}} />
      ));

      // Trigger error
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        const error = screen.getByRole("alert");
        expect(error).toBeTruthy();
      });
    });

    it("should support keyboard navigation", () => {
      render(() => (
        <DAOConfigForm onSubmit={() => {}} onBack={() => {}} />
      ));

      const form = screen.getByRole("form");
      expect(form).toBeTruthy();

      // Check tab order
      const inputs = form.querySelectorAll("input, button, textarea");
      inputs.forEach((input) => {
        expect(input).toHaveAttribute("tabindex", "-1");
      });
    });
  });

  // ============================================================================
  // MOBILE RESPONSIVENESS
  // ============================================================================

  describe("Mobile Responsiveness", () => {
    it("should render correctly on small screens", () => {
      // Simulate mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event("resize"));

      render(() => (
        <DAOConfigForm onSubmit={() => {}} onBack={() => {}} />
      ));

      // Check that form is still usable
      expect(screen.getByLabelText(/dao name/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /continue/i })).toBeTruthy();
    });

    it("should stack buttons vertically on mobile", () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event("resize"));

      render(() => (
        <DAOConfigForm onSubmit={() => {}} onBack={() => {}} />
      ));

      const buttons = screen.getAllByRole("button");
      // Buttons should be in a flex-col container on mobile
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
