// import { useTheme } from "../../context/ThemeContext";
// import { Sun, Moon, Monitor, Palette } from "lucide-react";

// function Settings() {
//   const { theme, setTheme } = useTheme();

//   return (
//     <div className="settings-page">
//       <div className="settings-header">
//         <h1>Settings</h1>
//         <p>Manage your application preferences.</p>
//       </div>

//       <div className="settings-card">
//         <div className="settings-card-header">
//           <div className="settings-icon">
//             <Palette size={22} />
//           </div>

//           <div>
//             <h2>Appearance</h2>
//             <p>Customize how SpendWise looks on your device.</p>
//           </div>
//         </div>

//         <div className="settings-section">
//           <h3>Theme Preference</h3>
//           <p>Choose your preferred application theme.</p>

//           <div className="theme-options">
//             <button
//               className={`theme-option ${theme === "light" ? "active" : ""}`}
//               onClick={() => setTheme("light")}
//               type="button"
//             >
//               <Sun size={22} />
//               <span>Light Mode</span>
//               {theme === "light" && <span className="theme-check">✓</span>}
//             </button>

//             <button
//               className={`theme-option ${theme === "dark" ? "active" : ""}`}
//               onClick={() => setTheme("dark")}
//               type="button"
//             >
//               <Moon size={22} />
//               <span>Dark Mode</span>
//               {theme === "dark" && <span className="theme-check">✓</span>}
//             </button>

//             <button
//               className={`theme-option ${theme === "system" ? "active" : ""}`}
//               onClick={() => setTheme("system")}
//               type="button"
//             >
//               <Monitor size={22} />
//               <span>System Default</span>
//               {theme === "system" && <span className="theme-check">✓</span>}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default Settings;

import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon, Monitor, Palette, ArrowLeft } from "lucide-react";

function Settings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="settings-page">
      <button
        type="button"
        className="settings-back-button"
        onClick={handleBack}
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your application preferences.</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-icon">
            <Palette size={22} />
          </div>

          <div>
            <h2>Appearance</h2>
            <p>Customize how SpendWise looks on your device.</p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Theme Preference</h3>
          <p>Choose your preferred application theme.</p>

          <div className="theme-options">
            <button
              type="button"
              className={`theme-option ${theme === "light" ? "active" : ""}`}
              onClick={() => setTheme("light")}
            >
              <Sun size={22} />
              <span>Light Mode</span>
              {theme === "light" && <span className="theme-check">✓</span>}
            </button>

            <button
              type="button"
              className={`theme-option ${theme === "dark" ? "active" : ""}`}
              onClick={() => setTheme("dark")}
            >
              <Moon size={22} />
              <span>Dark Mode</span>
              {theme === "dark" && <span className="theme-check">✓</span>}
            </button>

            <button
              type="button"
              className={`theme-option ${theme === "system" ? "active" : ""}`}
              onClick={() => setTheme("system")}
            >
              <Monitor size={22} />
              <span>System Default</span>
              {theme === "system" && <span className="theme-check">✓</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
