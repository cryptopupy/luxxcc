shared.luxxcc = {

	['Globals'] = {
		['Key'] = "ADMIN-INTERNAL-KEY",
		['Config Mode'] = "Cloud", -- Cloud / File

		['Brand'] = {
			['Enabled'] = true,
			['Feature'] = Color3.fromRGB(200, 200, 200),
			['Target'] = Color3.fromRGB(90, 90, 90),
			['Position'] = 'Low Center', -- Low Center / Top Center / Left Center / Right Center / Top Left / Top Right / Bottom Left / Bottom Right
		},
	},

	['Silent Aim'] = {
		['Enabled'] = true,
		['Max Range'] = math.huge,
		['Selection'] = 'Target', -- Automatic / Target

		['Bind'] = {
			['Key'] = 'C',
			['Type'] = 'toggle',
		},

		['Target Bind'] = {
			['Key'] = 'C',
		},

		['Checks'] = {
			['Alive'] = true,
			['Knocked'] = true,
			['Grabbed'] = true,
			['Vehicle'] = true,
			['Visible'] = true,
			['Tool'] = false,
			['Self Knocked'] = false,
			['Typing'] = true,
			['Crew'] = true,
		},

		['Target Tracer'] = {
			['Enabled'] = true,
			['Color'] = Color3.fromRGB(0, 0, 0),
		},

		['FOV'] = {
			['Enabled'] = false,
			['Visible'] = false,

			['Shape'] = '2D Box', -- Circle / 2D Box

			['Circle'] = {
				['Size'] = math.huge,
			},

			['Box'] = {
				['Width'] = math.huge,
				['Height'] = math.huge,
			},
		},

		['Target Part'] = {
			['Part'] = 'Closest Point', -- Head / HumanoidRootPart / Closest Part / Closest Point
		},

		['Prediction'] = {
			['Enabled'] = false,
			['Values'] = {
				['X'] = 0.13,
				['Y'] = 0.13,
				['Z'] = 0.13,
			},
		},

		['Auto Shoot'] = {
			['Enabled'] = false,
		},

		['Offscreen Targeting'] = {
			['Enabled'] = false,
		},

		['Future'] = {
			['Enabled'] = false,

			['Shotguns'] = {
				['Values'] = {
					['X'] = 0.13,
					['Y'] = 0.02,
					['Z'] = 0.13,
				},
			},
			['Pistols']  = {
				['Values'] = {
					['X'] = 0.13,
					['Y'] = 0.02,
					['Z'] = 0.13,
				},
			},
			['Others']   = {
				['Values'] = {
					['X'] = 0.13,
					['Y'] = 0.02,
					['Z'] = 0.13,
				},
			},
		},
	},

	['Aimbot'] = {
		['Enabled'] = false,
		['Mode'] = 'Toggle', -- Toggle / Hold
		['Max Range'] = math.huge,

		['Bind'] = {
			['Key'] = 'C',
			['Type'] = 'toggle',
		},

		['Checks'] = {
			['Alive'] = true,
			['Knocked'] = true,
			['Grabbed'] = true,
			['Vehicle'] = true,
			['Visible'] = true,
			['Tool'] = false,
			['Self Knocked'] = false,
			['Typing'] = true,
			['Crew'] = true,
		},

		['FOV'] = {
			['Enabled'] = true,
			['Visible'] = false,

			['Shape'] = 'Circle', -- Circle / 2D Box

			['Circle'] = {
				['Size'] = math.huge,
			},

			['Box'] = {
				['Width'] = 9e9,
				['Height'] = 9e9,
			},
		},

		['Target Part'] = {
			['Part'] = 'Head', -- Head / HumanoidRootPart / Closest Part / Closest Point
		},

		['Smoothing'] = {
			['Enabled'] = true,

			['X'] = 0.1,
			['Y'] = 0.1,
			['Z'] = 0.1,

			['Easing'] = {
				['In'] = 'Linear', -- EasingStyle
				['Out'] = 'InOut', -- EasingDirection
			},
		},

		['Prediction'] = {
			['Enabled'] = false,
			['Values'] = {
				['X'] = 0.13,
				['Y'] = 0.13,
				['Z'] = 0.13,
			},
		},
	},

	['Triggerbot'] = {
		['Enabled'] = false,
		['Max Range'] = math.huge,
		['Limit To Weapon Range'] = true, -- only fire if the target is within the equipped tool's Range value
		['Selection'] = 'Target', -- Automatic / Target

		['Delay'] = 0, -- seconds to wait before firing

		['Bind'] = {
			['Key'] = 'C',
			['Type'] = 'toggle',
		},

		['Target Bind'] = {
			['Key'] = 'C',
		},

		['Keybind'] = {
			['Key'] = 'MouseButton1',
			['Mode'] = 'Mouse', -- Mouse / Keybind
			['Type'] = 'Hold', -- Toggle / Hold
		},

		['Checks'] = {
			['Alive'] = true,
			['Knocked'] = true,
			['Grabbed'] = true,
			['Vehicle'] = true,
			['Visible'] = true,
			['Tool'] = false,
			['Self Knocked'] = false,
			['Typing'] = true,
			['Crew'] = true,
		},

		['FOV'] = {
			['Enabled'] = true,
			['Visible'] = false,

			['Shape'] = '2D Box', -- Circle / 2D Box

			['Circle'] = {
				['Size'] = math.huge,
			},

			['Box'] = {
				['Width'] = math.huge,
				['Height'] = math.huge,
			},
		},

		['Trigger Mode'] = 'Raycast', -- FOV / Raycast

		['Prediction'] = {
			['Enabled'] = false,
			['Values'] = {
				['X'] = 0.13,
				['Y'] = 0.13,
				['Z'] = 0.13,
			},
		},

		['Offscreen Targeting'] = {
			['Enabled'] = false,
		},
	},

	['Modifications'] = {

		['Double Tap'] = {
			['Enabled'] = false,

			['Bind'] = {
				['Key'] = 'G',
				['Type'] = 'toggle',
			},

			['Weapon Configs'] = {
				['Enabled'] = true,
				['Shotguns'] = { 
					['Enabled'] = true, 
				},	
				['Pistols']  = { 
					['Enabled'] = true, 
				},		
				['Others']   = { 
					['Enabled'] = false, 
				},
			},
		},

		['Spread Modifications'] = {
			['Enabled'] = true,
			['Value'] = 0.4,
			['Randomizer'] = {
				['Enabled'] = true,
				['Min'] = 0.3,
				['Max'] = 0.5,
			},

			['Spread Angles'] = {
				['Enabled'] = false, --// ts for remakes
				['Game'] = 'zee', -- 'zee' / 'das'
			},
		},

		['Misc Gun Modifications'] = {
			['No Recoil'] = true,

			['Range Enhancer'] = {
				['Enabled'] = false,
				['Value'] = 12, --// this is probably the max, going too high may cause detections and fake bullets.
			},
		},

		['Das Hood'] = {
			['Inf Range'] = {
				['Enabled'] = false,
			},

			['Wallbang'] = {
				['Enabled'] = false, --// this is detected in real da hood, do not use.
			},

			['Damage Modifier'] = {
				['Enabled'] = false,
				['Weapons'] = {
					['Shotguns'] = {
						['Enabled'] = false,
						['Mode'] = 'full',
					},
					['Pistols'] = {
						['Enabled'] = false,
						['Mode'] = 'full',
					},
					['Others'] = {
						['Enabled'] = true,
						['Mode'] = 'full',
					},
				},
			},
		},

		['Delay Changer'] = {
			['Enabled'] = false,
			['Delay'] = 0,

			['Weapon Configs'] = {
				['Enabled'] = false,
				['Shotguns'] = {
					['Delay'] = 0.05, 
				},
				['Pistols']  = {
					['Delay'] = 0.01, 
				},
				['Others']   = {
					['Delay'] = 0.02, 
				},
			},
		},
	},

	['Name ESP'] = {
		['Enabled'] = false,

		['Bind'] = {
			['Key'] = 'P',
			['Type'] = 'toggle',
		},

		['Color'] = Color3.fromRGB(255, 255, 255),
		['Target Color'] = Color3.fromRGB(90, 90, 90),
		['Text Size'] = 13,
		['Font'] = 'GothamBold', 
	},
	['Movement'] = {
		['Anti Trip'] = true,
		['No Jump Cooldown'] = true,

		['WalkSpeed'] = {
			['Enabled'] = false,
			['Mode'] = 'Number', -- Number / Multiplier

			['Bind'] = {
				['Key'] = 'T',
				['Type'] = 'toggle',
			},

			['Values'] = {
				['Number'] = 620,
				['Multiplier'] = 6.2,
			},
			['Conditions'] = {
				['Normal'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Knife'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Reload'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Shooting'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Low Health'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
			},
		},

		['JumpPower'] = {
			['Enabled'] = false,
			['Spiderman Mode'] = true,
			['Mode'] = 'Number', -- Number / Multiplier

			['Bind'] = {
				['Key'] = 'Y',
				['Type'] = 'toggle',
			},

			['Values'] = {
				['Number'] = 400,
				['Multiplier'] = 4,
			},
			['Conditions'] = {
				['Normal'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Knife'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Reload'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Shooting'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
				['Low Health'] = {
					['Enabled'] = true,
					['Multiplier'] = 1,
				},
			},
		},
	},

	['Utilities'] = {
		['Inventory Sorter'] = {
			['Enabled'] = false,

			['Bind'] = {
				['Key'] = 'F2',
				['Type'] = 'toggle',
			},

			['Order'] = {
				[1] = '[Double-Barrel SG]',
				[2] = '[Revolver]',
				[3] = '[TacticalShotgun]',
				[4] = '[Knife]',
			},
		},

		['Skin Changer'] = { --// disable any texture skins you have equipped for now, until we fix that problem.
			['Enabled'] = true,

			['Skins'] = {
				['[Double-Barrel SG]'] = 'Stars',
				['[Revolver]'] = 'Galaxy',
				['[TacticalShotgun]'] = 'Patriot',
				['[Knife]'] = 'Bat Sharp',
			},
		},

		['Animation Changer'] = {
			['Enabled'] = false,

			['Animations'] = {
				['Idle']  = 'Zombie',
				['Run']   = 'Zombie',
				['Walk']  = 'Zombie',
				['Jump']  = 'Ninja',
				['Fall']  = 'Ninja',
				['Climb'] = 'Ninja',
			},
		},

		['Hitbox Expander'] = {
			['Enabled'] = false,
			['Size'] = 8,
			['Target Only'] = true,
			['Visualize'] = false, -- shows hitbox as black transparent part
		},
	},

	['Anti Stomp'] = {
		['Enabled'] = false,
	},

	['Char'] = {
		['Enabled'] = false, -- this is kinda bs but its ez to fix
		['Target'] = 'richoffluau',

		['Body Size'] = {
			['Mode'] = 'Skinny', -- Skinny / Normal / Fat
		},
	},
}