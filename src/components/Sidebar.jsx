return (
  <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>

    {menuData.map(section => (
      <div key={section.section} className="sidebar-section">

        <div className="sidebar-section-title">
          {section.section}
        </div>

        {section.items.map(item => {

          const parentActive = isParentActive(item);
          const isExpanded = expandedMenus.includes(item.id);

          return (
            <div key={item.id}>

              {item.submenu ? (
                <>
                  <div
                    className={`sidebar-item ${parentActive ? "active" : ""}`}
                    onClick={() => toggleMenu(item.id)}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      size={16}
                      style={{
                        marginLeft: "auto",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "0.2s ease"
                      }}
                    />
                  </div>

                  {isExpanded && (
                    <div style={{ paddingLeft: collapsed ? 0 : 18 }}>
                      {item.submenu.map(subItem => (
                        <Link
                          key={subItem.id}
                          to={subItem.path}
                          className={`sidebar-item ${
                            isActive(subItem.path) ? "active" : ""
                          }`}
                          style={{
                            fontSize: "13px",
                            opacity: 0.9
                          }}
                        >
                          <span>{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  className={`sidebar-item ${
                    isActive(item.path) ? "active" : ""
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              )}

            </div>
          );
        })}

      </div>
    ))}

    <div
      className="sidebar-toggle"
      onClick={onToggle}
    >
      <ChevronDown
        size={16}
        style={{
          transform: collapsed ? "rotate(90deg)" : "rotate(-90deg)",
          transition: "0.2s ease"
        }}
      />
    </div>

  </aside>
);