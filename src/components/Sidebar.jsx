return (
  <aside className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">

    {/* Logo */}
    <div className="h-16 flex items-center px-6 border-b border-gray-200 bg-white">
      <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-md font-semibold text-sm">
        M
      </div>
      <span className="ml-3 text-lg font-semibold text-gray-900">
        MEP Projects
      </span>
    </div>

    {/* Navigation */}
    <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">

      {menuData.map(section => (
        <div key={section.section}>

          {/* Section Title */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {section.section}
          </p>

          <div className="space-y-1">
            {section.items.map(item => (
              <div key={item.id}>

                {/* If Has Submenu */}
                {item.submenu ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isParentActive(item)
                          ? "bg-gray-200 text-gray-900"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${
                          expandedMenus.includes(item.id) ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expandedMenus.includes(item.id) && (
                      <div className="mt-1 ml-4 space-y-1">
                        {item.submenu.map(subItem => (
                          <Link
                            key={subItem.id}
                            to={subItem.path}
                            className={`block px-3 py-2 text-sm rounded-md transition ${
                              isActive(subItem.path)
                                ? "bg-gray-200 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.path}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive(item.path)
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}

              </div>
            ))}
          </div>
        </div>
      ))}

    </nav>

    {/* Collapse Button */}
    <button
      onClick={onToggle}
      className="h-12 border-t border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
    >
      <ChevronDown size={16} className="rotate-90" />
    </button>

  </aside>
);